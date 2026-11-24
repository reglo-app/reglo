<?php

namespace App\Account;

use App\Diagnostic\Questionnaire;
use App\Entity\Action;
use App\Entity\ActionStatusChange;
use App\Entity\DiagnosticAnswer;
use App\Entity\Document;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Everything REGLO keeps about one user (US-04, GDPR right of access and
 * portability): their profile and organization, and what they did in it.
 * Only their own traces: the data of the organization itself (its other
 * actions, documents, diagnostics) is not personal data of the user.
 */
final class PersonalDataExporter
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly Questionnaire $questionnaire,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function export(User $user): array
    {
        $organization = $user->getOrganization();

        return [
            'exportedAt' => self::date(new \DateTimeImmutable()),
            'profile' => [
                'email' => $user->getEmail(),
                'firstName' => $user->getFirstName(),
                'lastName' => $user->getLastName(),
                'jobTitle' => $user->getJobTitle(),
                'role' => $user->getOrganizationRole()->value,
                'hasProfilePhoto' => null !== $user->getAvatarFile(),
                'createdAt' => self::date($user->getCreatedAt()),
                'activatedAt' => self::date($user->getActivatedAt()),
                'lastSeenAt' => self::date($user->getLastSeenAt()),
            ],
            'organization' => null === $organization ? null : ['name' => $organization->getName()],
            'actionsAssigned' => array_map(self::action(...), $this->actionsWhere('assignee', $user)),
            'actionsCreated' => array_map(self::action(...), $this->actionsWhere('createdBy', $user)),
            'actionStatusChanges' => array_map(static fn (ActionStatusChange $change): array => [
                'action' => $change->getAction()->getTitle(),
                'from' => $change->getFromStatus()?->value,
                'to' => $change->getToStatus()->value,
                'at' => self::date($change->getChangedAt()),
            ], $this->findBy(ActionStatusChange::class, 'changedBy', $user, 'changedAt')),
            'documentsUploaded' => array_map(static fn (Document $document): array => [
                'name' => $document->getOriginalName(),
                'type' => $document->getMimeType(),
                'size' => $document->getSize(),
                'domain' => $document->getPillar()?->value,
                'uploadedAt' => self::date($document->getCreatedAt()),
            ], $this->findBy(Document::class, 'uploadedBy', $user, 'createdAt')),
            'diagnosticAnswers' => array_map(fn (DiagnosticAnswer $answer): array => [
                'question' => $this->questionnaire->question($answer->getQuestionId())['label'] ?? $answer->getQuestionId(),
                'value' => $answer->getValue(),
                'notApplicable' => $answer->isNotApplicable(),
                'answeredAt' => self::date($answer->getAnsweredAt()),
            ], $this->findBy(DiagnosticAnswer::class, 'answeredBy', $user, 'answeredAt')),
        ];
    }

    /**
     * "reglo-mes-donnees-2026-11-23.json".
     */
    public static function fileName(): string
    {
        return \sprintf('reglo-mes-donnees-%s.json', (new \DateTimeImmutable('now', new \DateTimeZone('Europe/Paris')))->format('Y-m-d'));
    }

    /**
     * @return list<Action>
     */
    private function actionsWhere(string $field, User $user): array
    {
        return $this->findBy(Action::class, $field, $user, 'createdAt');
    }

    /**
     * @template T of object
     *
     * @param class-string<T> $class
     *
     * @return list<T>
     */
    private function findBy(string $class, string $field, User $user, string $orderBy): array
    {
        return $this->entityManager->createQueryBuilder()
            ->select('e')
            ->from($class, 'e')
            ->where(\sprintf('e.%s = :user', $field))
            ->setParameter('user', $user)
            ->orderBy('e.'.$orderBy, 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return array<string, mixed>
     */
    private static function action(Action $action): array
    {
        return [
            'title' => $action->getTitle(),
            'description' => $action->getDescription(),
            'domain' => $action->getPillar()->value,
            'type' => $action->getType()->value,
            'status' => $action->getStatus()->value,
            'dueDate' => $action->getDueDate()->format('Y-m-d'),
            'createdAt' => self::date($action->getCreatedAt()),
        ];
    }

    private static function date(?\DateTimeImmutable $date): ?string
    {
        return $date?->format(\DATE_ATOM);
    }
}
