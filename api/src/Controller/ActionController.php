<?php

namespace App\Controller;

use App\ActionPlan\ActionDueDates;
use App\ActionPlan\ActionDueFilter;
use App\Entity\Action;
use App\Entity\ActionStatus;
use App\Entity\ActionStatusChange;
use App\Entity\ActionType;
use App\Entity\OrganizationRole;
use App\Entity\QhsePillar;
use App\Entity\User;
use App\Mailer\ActionAssignedMailer;
use App\Repository\ActionRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Exception\JsonException;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Action plan of the organization (US-09). Every role consults it;
 * administrators and members create, change and delete actions (readers
 * are refused by security.yaml); the status is moved by the assignee or an
 * administrator. Another organization's action is never found
 * (OrganizationFilter), and an action is only given to a colleague.
 */
#[Route('/api/actions', name: 'action_')]
final class ActionController
{
    public const STATUS_FORBIDDEN = 'Seuls le responsable de l\'action et les administrateurs peuvent changer son statut.';

    /** Actions listed by each block of the dashboard. */
    private const OVERVIEW_LIMIT = 5;

    public function __construct(
        private readonly ActionRepository $repository,
        private readonly UserRepository $userRepository,
        private readonly EntityManagerInterface $entityManager,
        private readonly ActionAssignedMailer $mailer,
        private readonly LoggerInterface $logger,
        private readonly ActionDueDates $dueDates,
    ) {
    }

    /**
     * Soonest due first, or latest with order=desc. Optional filters: status,
     * domain, type, assignee (id), due (overdue, soon or upcoming).
     */
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $query = $request->query;
        $status = ActionStatus::tryFrom($query->getString('status'));
        $pillar = QhsePillar::tryFrom($query->getString('domain'));
        $type = ActionType::tryFrom($query->getString('type'));
        $due = ActionDueFilter::tryFrom($query->getString('due'));
        $assignee = $query->getString('assignee');
        $order = $query->getString('order');

        if (
            (null === $status && '' !== $query->getString('status'))
            || (null === $pillar && '' !== $query->getString('domain'))
            || (null === $type && '' !== $query->getString('type'))
            || (null === $due && '' !== $query->getString('due'))
            || ('' !== $assignee && !ctype_digit($assignee))
            || !\in_array($order, ['', 'asc', 'desc'], true)
        ) {
            return self::error('Ce filtre n\'existe pas.', 'invalid_filter');
        }

        $actions = $this->repository->findFiltered(
            $status,
            $pillar,
            $type,
            '' === $assignee ? null : (int) $assignee,
            $due,
            $this->dueDates->today(),
            $this->dueDates->dueSoonLimit(),
            'desc' === $order,
        );

        return new JsonResponse(array_map(fn (Action $action): array => $this->view($action), $actions));
    }

    /**
     * For the dashboard: how many actions in each status, late and due soon,
     * the most urgent ones and the next ones to do.
     */
    #[Route('/overview', name: 'overview', methods: ['GET'])]
    public function overview(): JsonResponse
    {
        $today = $this->dueDates->today();
        $actions = $this->repository->findFiltered(null, null, null, null, null, $today, $this->dueDates->dueSoonLimit());

        $counts = ['overdue' => 0, 'dueSoon' => 0];
        foreach (ActionStatus::cases() as $status) {
            $counts[$status->value] = 0;
        }
        $urgent = [];
        $upcoming = [];
        foreach ($actions as $action) {
            ++$counts[$action->getStatus()->value];

            $overdue = $this->dueDates->isOverdue($action);
            $dueSoon = $this->dueDates->isDueSoon($action);
            $counts['overdue'] += (int) $overdue;
            $counts['dueSoon'] += (int) $dueSoon;

            if ($overdue || $dueSoon) {
                $urgent[] = $action;
            }
            if (!$overdue && ActionStatus::Done !== $action->getStatus()) {
                $upcoming[] = $action;
            }
        }

        $views = fn (array $list): array => array_map(fn (Action $action): array => $this->view($action), \array_slice($list, 0, self::OVERVIEW_LIMIT));

        return new JsonResponse([
            'today' => $today->format('Y-m-d'),
            'counts' => $counts,
            'urgent' => $views($urgent),
            'upcoming' => $views($upcoming),
        ]);
    }

    #[Route('/{id}', name: 'show', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function show(int $id, #[CurrentUser] User $user): JsonResponse
    {
        $action = $this->findAction($id, $user);

        return null === $action ? self::notFound() : new JsonResponse($this->view($action, withHistory: true));
    }

    /**
     * Body: {"title", "description", "domain", "type", "assigneeId",
     * "dueDate": "YYYY-MM-DD"}. The assignee gets an e-mail, unless they
     * created the action themselves.
     */
    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $organization = $user->getOrganization();
        if (null === $organization) {
            return self::error('Votre compte n\'appartient à aucune organisation.', 'no_organization', Response::HTTP_FORBIDDEN);
        }

        $input = $this->readInput($request, $user, null);
        if ($input instanceof JsonResponse) {
            return $input;
        }

        $action = new Action($organization, $input['title'], $input['description'], $input['pillar'], $input['type'], $input['dueDate'], $input['assignee'], $user);
        $this->entityManager->persist($action);
        $this->entityManager->flush();

        if ($input['assignee']->getId() !== $user->getId()) {
            $this->tellAssignee($action, $user);
        }

        return new JsonResponse($this->view($action, withHistory: true), Response::HTTP_CREATED);
    }

    /**
     * Same body as the creation, every field sent. A new assignee gets an
     * e-mail. The due date may stay in the past (a late action can still be
     * edited), but cannot be moved there.
     */
    #[Route('/{id}', name: 'update', requirements: ['id' => '\d+'], methods: ['PATCH'])]
    public function update(int $id, Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $action = $this->findAction($id, $user);
        if (null === $action) {
            return self::notFound();
        }

        $input = $this->readInput($request, $user, $action);
        if ($input instanceof JsonResponse) {
            return $input;
        }

        $previousAssignee = $action->getAssignee();
        $action->change($input['title'], $input['description'], $input['pillar'], $input['type'], $input['dueDate'], $input['assignee']);
        $this->entityManager->flush();

        if ($input['assignee']->getId() !== $previousAssignee?->getId() && $input['assignee']->getId() !== $user->getId()) {
            $this->tellAssignee($action, $user);
        }

        return new JsonResponse($this->view($action, withHistory: true));
    }

    #[Route('/{id}', name: 'delete', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function delete(int $id, #[CurrentUser] User $user): Response
    {
        $action = $this->findAction($id, $user);
        if (null === $action) {
            return self::notFound();
        }

        $this->entityManager->remove($action);
        $this->entityManager->flush();

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * Body: {"status": "todo" | "in_progress" | "in_review" | "done"}, one
     * step forward or back. Kept in the history (who, when).
     */
    #[Route('/{id}/status', name: 'status', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function status(int $id, Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $action = $this->findAction($id, $user);
        if (null === $action) {
            return self::notFound();
        }

        if (OrganizationRole::Admin !== $user->getOrganizationRole() && $action->getAssignee()?->getId() !== $user->getId()) {
            return self::error(self::STATUS_FORBIDDEN, 'status_forbidden', Response::HTTP_FORBIDDEN);
        }

        $status = ActionStatus::tryFrom(JsonBody::string($request, 'status'));
        if (null === $status || !$action->getStatus()->canMoveTo($status)) {
            return self::error('Une action avance d\'une étape à la fois : à faire, en cours, en revue, terminée.', 'invalid_status');
        }

        $action->moveTo($status, $user);
        $this->entityManager->flush();

        return new JsonResponse($this->view($action, withHistory: true));
    }

    /**
     * Checks the body of a creation or an update. Every invalid field gets
     * its message, under the name of the field of the web form.
     *
     * @return array{title: string, description: string, pillar: QhsePillar, type: ActionType, dueDate: \DateTimeImmutable, assignee: User}|JsonResponse
     */
    private function readInput(Request $request, User $user, ?Action $action): array|JsonResponse
    {
        try {
            $body = $request->toArray();
        } catch (JsonException) {
            $body = [];
        }
        $text = static fn (string $name): string => \is_string($body[$name] ?? null) ? trim($body[$name]) : '';
        $errors = [];

        $title = $text('title');
        if ('' === $title) {
            $errors['title'] = 'Donnez un titre à l\'action.';
        } elseif (mb_strlen($title) > Action::TITLE_MAX_LENGTH) {
            $errors['title'] = \sprintf('Le titre ne doit pas dépasser %d caractères.', Action::TITLE_MAX_LENGTH);
        }

        $description = $text('description');
        if (mb_strlen($description) > Action::DESCRIPTION_MAX_LENGTH) {
            $errors['description'] = \sprintf('La description ne doit pas dépasser %d caractères.', Action::DESCRIPTION_MAX_LENGTH);
        }

        $pillar = QhsePillar::tryFrom($text('domain'));
        if (null === $pillar) {
            $errors['domain'] = 'Choisissez le domaine de l\'action.';
        }

        $type = ActionType::tryFrom($text('type'));
        if (null === $type) {
            $errors['type'] = 'Choisissez le type d\'action : corrective, préventive ou amélioration.';
        }

        $assignee = $this->findAssignee($body['assigneeId'] ?? null, $user, $errors);

        $dueDate = \DateTimeImmutable::createFromFormat('!Y-m-d', $text('dueDate'));
        if (false === $dueDate || $dueDate->format('Y-m-d') !== $text('dueDate')) {
            $errors['dueDate'] = 'Indiquez l\'échéance de l\'action.';
        } elseif ($dueDate->format('Y-m-d') < $this->dueDates->today()->format('Y-m-d') && $dueDate->format('Y-m-d') !== $action?->getDueDate()->format('Y-m-d')) {
            $errors['dueDate'] = 'L\'échéance ne peut pas être dans le passé.';
        }

        if ([] !== $errors || null === $pillar || null === $type || null === $assignee || false === $dueDate) {
            return new JsonResponse([
                'error' => 'L\'action n\'est pas enregistrée : corrigez les champs signalés.',
                'code' => 'invalid_action',
                'fields' => $errors,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return ['title' => $title, 'description' => $description, 'pillar' => $pillar, 'type' => $type, 'dueDate' => $dueDate, 'assignee' => $assignee];
    }

    /**
     * An activated administrator or member of the organization of the user.
     * A user of another organization gets the same answer as an unknown
     * one: nobody learns it exists.
     *
     * @param array<string, string> $errors
     */
    private function findAssignee(mixed $id, User $user, array &$errors): ?User
    {
        $assignee = \is_int($id) || (\is_string($id) && ctype_digit($id)) ? $this->userRepository->find((int) $id) : null;
        $organization = $user->getOrganization();

        if (null === $id || '' === $id) {
            $errors['assigneeId'] = 'Choisissez le responsable de l\'action.';
        } elseif (null === $assignee || null === $organization || $assignee->getOrganization()?->getId() !== $organization->getId()) {
            $errors['assigneeId'] = 'Choisissez le responsable parmi les membres de votre organisation.';
        } elseif (!$assignee->isActivated()) {
            $errors['assigneeId'] = 'Ce membre n\'a pas encore activé son compte : choisissez quelqu\'un d\'autre.';
        } elseif (OrganizationRole::Reader === $assignee->getOrganizationRole()) {
            $errors['assigneeId'] = 'Un lecteur ne peut pas être responsable d\'une action : choisissez un administrateur ou un membre.';
        } else {
            return $assignee;
        }

        return null;
    }

    /**
     * The action is saved even if the e-mail fails: it is only a notice,
     * the action is in the action plan.
     */
    private function tellAssignee(Action $action, User $assignedBy): void
    {
        try {
            $this->mailer->send($action, $assignedBy);
        } catch (TransportExceptionInterface $exception) {
            $this->logger->error('Action assignment e-mail could not be sent.', ['exception' => $exception]);
        }
    }

    /**
     * The action, if it belongs to the organization of the user. Already
     * ensured by OrganizationFilter; checked again in case the action was
     * loaded earlier in the request, from memory, without the filter.
     */
    private function findAction(int $id, User $user): ?Action
    {
        $action = $this->repository->find($id);
        $organization = $user->getOrganization();

        if (null === $action || null === $organization || $action->getOrganization()?->getId() !== $organization->getId()) {
            return null;
        }

        return $action;
    }

    /**
     * Shape of Action in web/src/lib/api/types.ts; the history only on one
     * action.
     *
     * @return array<string, mixed>
     */
    private function view(Action $action, bool $withHistory = false): array
    {
        $view = [
            'id' => (string) $action->getId(),
            'title' => $action->getTitle(),
            'description' => $action->getDescription(),
            'domain' => $action->getPillar()->value,
            'type' => $action->getType()->value,
            'status' => $action->getStatus()->value,
            'dueDate' => $action->getDueDate()->format('Y-m-d'),
            'isOverdue' => $this->dueDates->isOverdue($action),
            'isDueSoon' => $this->dueDates->isDueSoon($action),
            'assignee' => self::person($action->getAssignee()),
            'createdBy' => self::person($action->getCreatedBy()),
            'createdAt' => $action->getCreatedAt()->format(\DATE_ATOM),
            'updatedAt' => $action->getUpdatedAt()->format(\DATE_ATOM),
        ];

        if ($withHistory) {
            $view['history'] = array_map(static fn (ActionStatusChange $change): array => [
                'from' => $change->getFromStatus()?->value,
                'to' => $change->getToStatus()->value,
                'by' => self::person($change->getChangedBy()),
                'at' => $change->getChangedAt()->format(\DATE_ATOM),
            ], $action->getStatusChanges()->getValues());
        }

        return $view;
    }

    /**
     * @return array{id: string, firstName: ?string, lastName: ?string, email: string}|null
     */
    private static function person(?User $user): ?array
    {
        return null === $user ? null : [
            'id' => (string) $user->getId(),
            'firstName' => $user->getFirstName(),
            'lastName' => $user->getLastName(),
            'email' => $user->getEmail(),
        ];
    }

    private static function error(string $message, string $code, int $status = Response::HTTP_UNPROCESSABLE_ENTITY): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'code' => $code], $status);
    }

    private static function notFound(): JsonResponse
    {
        return self::error('Cette action n\'existe pas ou a été supprimée.', 'not_found', Response::HTTP_NOT_FOUND);
    }
}
