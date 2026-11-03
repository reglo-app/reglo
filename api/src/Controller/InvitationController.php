<?php

namespace App\Controller;

use App\Entity\Invitation;
use App\Entity\User;
use App\Mailer\InvitationMailer;
use App\Repository\InvitationRepository;
use App\Repository\UserRepository;
use App\Security\InvitationManager;
use App\Security\PasswordPolicy;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Invitation of collaborators (US-03). An administrator invites by e-mail
 * and manages the pending invitations of their organization (other
 * organizations' invitations are filtered out: 404). The invited person
 * accepts through the public routes /check and /accept, where the token of
 * the link is the proof.
 */
#[Route('/api/invitations', name: 'invitation_')]
final class InvitationController
{
    public const INVALID_LINK = 'Cette invitation a expiré ou a déjà été utilisée. Demandez une nouvelle invitation à votre administrateur.';
    public const EMAIL_UNAVAILABLE = 'Cette adresse e-mail ne peut pas être invitée.';
    public const TOO_MANY = 'Vous avez envoyé beaucoup d\'invitations. Réessayez dans une heure.';

    public function __construct(
        private readonly InvitationManager $invitationManager,
        private readonly InvitationMailer $invitationMailer,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[Route('', name: 'list', methods: ['GET'])]
    #[IsGranted('ROLE_ADMIN')]
    public function list(InvitationRepository $repository): JsonResponse
    {
        return new JsonResponse(array_map(self::view(...), $repository->findPending()));
    }

    #[Route('', name: 'create', methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    public function create(
        Request $request,
        #[CurrentUser] User $admin,
        InvitationRepository $invitationRepository,
        UserRepository $userRepository,
        ValidatorInterface $validator,
        RateLimiterFactoryInterface $invitationLimiter,
    ): JsonResponse {
        $organization = $admin->getOrganization();
        if (null === $organization) {
            return self::error('Votre compte n\'appartient à aucune organisation.', 'no_organization', Response::HTTP_FORBIDDEN);
        }

        $email = User::normalizeEmail(JsonBody::string($request, 'email'));
        $firstName = trim(JsonBody::string($request, 'firstName'));
        $lastName = trim(JsonBody::string($request, 'lastName'));

        $errors = array_filter([
            'email' => \count($validator->validate($email, [
                new Assert\NotBlank(),
                new Assert\Email(),
                new Assert\Length(max: User::MAX_EMAIL_LENGTH),
            ])) > 0 ? 'Saisissez une adresse e-mail valide.' : null,
            'firstName' => self::nameError($firstName, 'prénom'),
            'lastName' => self::nameError($lastName, 'nom'),
        ]);

        if ([] !== $errors) {
            return new JsonResponse([
                'error' => reset($errors),
                'code' => 'invalid_invitation',
                'fields' => $errors,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Neutral: never tells in which organization the address is used.
        if (null !== $userRepository->findOneByEmail($email)) {
            return self::error(self::EMAIL_UNAVAILABLE, 'email_unavailable');
        }
        if (null !== $invitationRepository->findOneByEmail($email)) {
            return self::error('Une invitation est déjà en attente pour cette adresse. Vous pouvez la renvoyer depuis la liste.', 'already_invited');
        }
        if (!$invitationLimiter->create('user-'.$admin->getId())->consume()->isAccepted()) {
            return self::error(self::TOO_MANY, 'too_many_invitations', Response::HTTP_TOO_MANY_REQUESTS);
        }

        $invitation = (new Invitation($organization, $email, $admin))->setName($firstName, $lastName);

        return new JsonResponse(
            self::view($invitation, $this->sendLink($invitation)),
            Response::HTTP_CREATED,
        );
    }

    #[Route('/{id}', name: 'cancel', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    #[IsGranted('ROLE_ADMIN')]
    public function cancel(int $id, InvitationRepository $repository, EntityManagerInterface $entityManager): Response
    {
        $invitation = $repository->find($id);
        if (null === $invitation) {
            return self::notFound();
        }

        $entityManager->remove($invitation);
        $entityManager->flush();

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * New link valid for the full duration again, also for an expired
     * invitation.
     */
    #[Route('/{id}/resend', name: 'resend', requirements: ['id' => '\d+'], methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    public function resend(
        int $id,
        #[CurrentUser] User $admin,
        InvitationRepository $repository,
        RateLimiterFactoryInterface $invitationLimiter,
    ): JsonResponse {
        $invitation = $repository->find($id);
        if (null === $invitation) {
            return self::notFound();
        }
        if (!$invitationLimiter->create('user-'.$admin->getId())->consume()->isAccepted()) {
            return self::error(self::TOO_MANY, 'too_many_invitations', Response::HTTP_TOO_MANY_REQUESTS);
        }

        return new JsonResponse(self::view($invitation, $this->sendLink($invitation)));
    }

    /**
     * Lets the web app show the invitation before the person types anything.
     */
    #[Route('/check', name: 'check', methods: ['POST'])]
    public function check(Request $request): JsonResponse
    {
        $invitation = $this->invitationManager->findValid(JsonBody::string($request, 'token'));
        if (null === $invitation) {
            return self::invalidLink();
        }

        $inviter = $invitation->getInvitedBy();

        return new JsonResponse([
            'email' => $invitation->getEmail(),
            'firstName' => $invitation->getFirstName(),
            'lastName' => $invitation->getLastName(),
            'organizationName' => $invitation->getOrganization()?->getName(),
            'inviterName' => null === $inviter ? null : self::fullName($inviter),
        ]);
    }

    /**
     * Creates the account of the invited person, who can then log in.
     */
    #[Route('/accept', name: 'accept', methods: ['POST'])]
    public function accept(Request $request, UserRepository $userRepository): JsonResponse
    {
        $invitation = $this->invitationManager->findValid(JsonBody::string($request, 'token'));
        if (null === $invitation) {
            return self::invalidLink();
        }

        $firstName = trim(JsonBody::string($request, 'firstName'));
        $lastName = trim(JsonBody::string($request, 'lastName'));
        $password = JsonBody::string($request, 'password');

        $errors = array_filter([
            'firstName' => self::nameError($firstName, 'prénom', required: true),
            'lastName' => self::nameError($lastName, 'nom', required: true),
            'password' => PasswordPolicy::isAcceptable($password) ? null : PasswordPolicy::errorMessage(),
        ]);

        if ([] !== $errors) {
            return new JsonResponse([
                'error' => reset($errors),
                'code' => 'invalid_account',
                'fields' => $errors,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // The address got an account since the invitation was sent.
        $emailTaken = self::error(
            'Un compte existe déjà avec cette adresse e-mail. Connectez-vous, ou demandez une invitation pour une autre adresse.',
            'email_unavailable',
            Response::HTTP_CONFLICT,
        );
        if (null !== $userRepository->findOneByEmail($invitation->getEmail())) {
            return $emailTaken;
        }

        try {
            $user = $this->invitationManager->accept($invitation, $firstName, $lastName, $password);
        } catch (UniqueConstraintViolationException) {
            return $emailTaken;
        }

        return new JsonResponse(['email' => $user->getEmail()], Response::HTTP_CREATED);
    }

    /**
     * Issues a new link and e-mails it. The invitation is saved even when
     * the e-mail fails: the administrator can send it again.
     *
     * @return bool whether the e-mail was sent
     */
    private function sendLink(Invitation $invitation): bool
    {
        $token = $this->invitationManager->issue($invitation);

        try {
            $this->invitationMailer->send($invitation, $token);
        } catch (TransportExceptionInterface $exception) {
            $this->logger->error('Invitation e-mail could not be sent.', ['exception' => $exception]);

            return false;
        }

        return true;
    }

    /**
     * Shape of Invitation in web/src/lib/api/types.ts.
     *
     * @return array<string, mixed>
     */
    private static function view(Invitation $invitation, ?bool $emailSent = null): array
    {
        $inviter = $invitation->getInvitedBy();

        $view = [
            'id' => (string) $invitation->getId(),
            'email' => $invitation->getEmail(),
            'firstName' => $invitation->getFirstName(),
            'lastName' => $invitation->getLastName(),
            'invitedBy' => null === $inviter ? null : self::fullName($inviter),
            'sentAt' => $invitation->getSentAt()->format(\DATE_ATOM),
            'expiresAt' => $invitation->getExpiresAt()->format(\DATE_ATOM),
            'expired' => $invitation->isExpired(),
        ];

        // Only right after a sending
        if (null !== $emailSent) {
            $view['emailSent'] = $emailSent;
        }

        return $view;
    }

    private static function fullName(User $user): string
    {
        $name = trim(\sprintf('%s %s', $user->getFirstName(), $user->getLastName()));

        return '' === $name ? $user->getEmail() : $name;
    }

    /**
     * @param string $label "prénom" or "nom"
     */
    private static function nameError(string $value, string $label, bool $required = false): ?string
    {
        if ($required && '' === $value) {
            return \sprintf('Saisissez votre %s.', $label);
        }

        return mb_strlen($value) > User::MAX_NAME_LENGTH
            ? \sprintf('Le %s ne doit pas dépasser %d caractères.', $label, User::MAX_NAME_LENGTH)
            : null;
    }

    private static function error(string $message, string $code, int $status = Response::HTTP_UNPROCESSABLE_ENTITY): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'code' => $code], $status);
    }

    private static function notFound(): JsonResponse
    {
        return self::error('Cette invitation n\'existe plus.', 'not_found', Response::HTTP_NOT_FOUND);
    }

    private static function invalidLink(): JsonResponse
    {
        return self::error(self::INVALID_LINK, 'invalid_token', Response::HTTP_GONE);
    }
}
