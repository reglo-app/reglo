<?php

namespace App\Controller;

use App\Command\CreateUserCommand;
use App\Mailer\ActivationMailer;
use App\Repository\ActivationTokenRepository;
use App\Repository\UserRepository;
use App\Security\ActivationTokenManager;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Exception\JsonException;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Account activation (US-01): the new user opens the link of the e-mail and
 * chooses a password. Public routes: the token is the proof of identity.
 */
#[Route('/api/activation', name: 'activation_')]
final class ActivationController
{
    public const INVALID_LINK = 'Ce lien d\'activation a expiré ou a déjà été utilisé.';

    /** A new link can be asked at most once per period, in seconds. */
    public const RESEND_COOLDOWN = 300;

    public function __construct(
        private readonly ActivationTokenManager $tokenManager,
    ) {
    }

    /**
     * Lets the web app show the right screen before the user types anything.
     */
    #[Route('/check', name: 'check', methods: ['POST'])]
    public function check(Request $request): JsonResponse
    {
        $token = $this->tokenManager->findValid(self::stringField($request, 'token'));

        if (null === $token) {
            return self::invalidLink();
        }

        $user = $token->getUser();

        return new JsonResponse([
            'email' => $user->getEmail(),
            'firstName' => $user->getFirstName(),
            'organizationName' => $user->getOrganization()?->getName(),
        ]);
    }

    #[Route('', name: 'activate', methods: ['POST'])]
    public function activate(
        Request $request,
        UserPasswordHasherInterface $passwordHasher,
        EntityManagerInterface $entityManager,
    ): JsonResponse|Response {
        $token = $this->tokenManager->findValid(self::stringField($request, 'token'));

        if (null === $token) {
            return self::invalidLink();
        }

        $password = self::stringField($request, 'password');
        $length = mb_strlen($password);

        if ($length < CreateUserCommand::MIN_PASSWORD_LENGTH || \strlen($password) > PasswordHasherInterface::MAX_PASSWORD_LENGTH) {
            return new JsonResponse([
                'error' => \sprintf('Le mot de passe doit contenir au moins %d caractères.', CreateUserCommand::MIN_PASSWORD_LENGTH),
                'code' => 'weak_password',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user = $token->getUser();
        $user->activate($passwordHasher->hashPassword($user, $password));
        $this->tokenManager->consume($token);
        $entityManager->flush();

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * Sends a new link when the previous one expired. Always the same answer,
     * so it never tells whether an account exists.
     */
    #[Route('/resend', name: 'resend', methods: ['POST'])]
    public function resend(
        Request $request,
        UserRepository $userRepository,
        ActivationTokenRepository $tokenRepository,
        ActivationMailer $activationMailer,
        LoggerInterface $logger,
    ): Response {
        $user = $userRepository->findOneByEmail(self::stringField($request, 'email'));
        $latest = null === $user ? null : $tokenRepository->findLatestForUser($user);
        $tooSoon = null !== $latest
            && $latest->getCreatedAt() > new \DateTimeImmutable(\sprintf('-%d seconds', self::RESEND_COOLDOWN));

        if (null !== $user && !$user->isActivated() && !$tooSoon) {
            try {
                $activationMailer->send($user);
            } catch (TransportExceptionInterface $exception) {
                $logger->error('Activation e-mail could not be sent.', ['exception' => $exception]);
            }
        }

        return new Response(status: Response::HTTP_ACCEPTED);
    }

    private static function invalidLink(): JsonResponse
    {
        return new JsonResponse(['error' => self::INVALID_LINK, 'code' => 'invalid_token'], Response::HTTP_GONE);
    }

    /**
     * Reads a string from the JSON body; anything else (missing field,
     * number, invalid JSON) gives an empty string.
     */
    private static function stringField(Request $request, string $name): string
    {
        try {
            $value = $request->toArray()[$name] ?? '';
        } catch (JsonException) {
            return '';
        }

        return \is_string($value) ? $value : '';
    }
}
