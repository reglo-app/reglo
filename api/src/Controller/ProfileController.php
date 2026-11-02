<?php

namespace App\Controller;

use App\Entity\User;
use App\Mailer\ProfileMailer;
use App\Repository\EmailChangeRequestRepository;
use App\Security\AccessTokenManager;
use App\Security\BearerToken;
use App\Security\EmailChangeManager;
use App\Security\PasswordPolicy;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * "Mon profil": the signed-in user changes their own account. Every user
 * can, whatever their role; nobody can change someone else's account here.
 */
#[Route('/api/me', name: 'profile_')]
final class ProfileController
{
    public const WRONG_PASSWORD = 'Le mot de passe actuel est incorrect.';

    /** The same new address can be asked again after this delay, in seconds. */
    public const EMAIL_CHANGE_COOLDOWN = 60;

    /**
     * Names and job title. All fields are sent each time (the profile form).
     */
    #[Route('', name: 'update', methods: ['PATCH'])]
    public function update(Request $request, #[CurrentUser] User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        $firstName = trim(JsonBody::string($request, 'firstName'));
        $lastName = trim(JsonBody::string($request, 'lastName'));
        $jobTitle = trim(JsonBody::string($request, 'jobTitle'));

        $errors = array_filter([
            'firstName' => self::nameError($firstName, 'prénom'),
            'lastName' => self::nameError($lastName, 'nom'),
            'jobTitle' => mb_strlen($jobTitle) > User::MAX_JOB_TITLE_LENGTH
                ? \sprintf('La fonction ne doit pas dépasser %d caractères.', User::MAX_JOB_TITLE_LENGTH)
                : null,
        ]);

        if ([] !== $errors) {
            return new JsonResponse([
                'error' => reset($errors),
                'code' => 'invalid_profile',
                'fields' => $errors,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->setName($firstName, $lastName)->setJobTitle($jobTitle);
        $entityManager->flush();

        return new JsonResponse(CurrentUserView::of($user));
    }

    /**
     * Logs out the other sessions: if the password leaked, they may not be
     * the user's.
     */
    #[Route('/password', name: 'password', methods: ['POST'])]
    public function changePassword(
        Request $request,
        #[CurrentUser] User $user,
        UserPasswordHasherInterface $passwordHasher,
        EntityManagerInterface $entityManager,
        AccessTokenManager $accessTokenManager,
    ): Response {
        if (!$passwordHasher->isPasswordValid($user, JsonBody::string($request, 'currentPassword'))) {
            return self::error(self::WRONG_PASSWORD, 'wrong_password');
        }

        $newPassword = JsonBody::string($request, 'newPassword');
        if (!PasswordPolicy::isAcceptable($newPassword)) {
            return self::error(PasswordPolicy::errorMessage(), 'weak_password');
        }

        $user->setPassword($passwordHasher->hashPassword($user, $newPassword));
        $entityManager->flush();
        $accessTokenManager->revokeAllForUser($user, BearerToken::fromRequest($request));

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * Sends a confirmation link to the new address. Same answer whether the
     * address is free or already used, so it never tells who has an account.
     */
    #[Route('/email', name: 'email', methods: ['POST'])]
    public function requestEmailChange(
        Request $request,
        #[CurrentUser] User $user,
        UserPasswordHasherInterface $passwordHasher,
        EmailChangeManager $emailChangeManager,
        EmailChangeRequestRepository $requestRepository,
        ProfileMailer $profileMailer,
        ValidatorInterface $validator,
        LoggerInterface $logger,
    ): Response {
        if (!$passwordHasher->isPasswordValid($user, JsonBody::string($request, 'currentPassword'))) {
            return self::error(self::WRONG_PASSWORD, 'wrong_password');
        }

        $newEmail = User::normalizeEmail(JsonBody::string($request, 'email'));
        $violations = $validator->validate($newEmail, [
            new Assert\NotBlank(),
            new Assert\Email(),
            new Assert\Length(max: User::MAX_EMAIL_LENGTH),
        ]);

        if (\count($violations) > 0) {
            return self::error('Saisissez une adresse e-mail valide.', 'invalid_email');
        }
        if ($newEmail === $user->getEmail()) {
            return self::error('C\'est déjà l\'adresse e-mail de votre compte.', 'same_email');
        }

        $latest = $requestRepository->findLatestForUser($user);
        $askedJustBefore = null !== $latest
            && $latest->getNewEmail() === $newEmail
            && $latest->getCreatedAt() > new \DateTimeImmutable(\sprintf('-%d seconds', self::EMAIL_CHANGE_COOLDOWN));

        if (!$askedJustBefore && !$emailChangeManager->isEmailTaken($newEmail)) {
            $token = $emailChangeManager->request($user, $newEmail);

            try {
                $profileMailer->sendEmailChangeConfirmation($user, $newEmail, $token);
            } catch (TransportExceptionInterface $exception) {
                $logger->error('E-mail change confirmation could not be sent.', ['exception' => $exception]);
            }
        }

        return new Response(status: Response::HTTP_ACCEPTED);
    }

    /**
     * @param string $label "prénom" or "nom"
     */
    private static function nameError(string $value, string $label): ?string
    {
        if ('' === $value) {
            return \sprintf('Saisissez votre %s.', $label);
        }

        return mb_strlen($value) > User::MAX_NAME_LENGTH
            ? \sprintf('Le %s ne doit pas dépasser %d caractères.', $label, User::MAX_NAME_LENGTH)
            : null;
    }

    private static function error(string $message, string $code): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'code' => $code], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}
