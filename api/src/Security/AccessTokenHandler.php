<?php

namespace App\Security;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Http\AccessToken\AccessTokenHandlerInterface;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;

/**
 * Authenticates API requests sent with "Authorization: Bearer <token>", and
 * records the last activity of the user ("Équipe" page).
 */
final class AccessTokenHandler implements AccessTokenHandlerInterface
{
    public function __construct(
        private readonly AccessTokenManager $tokenManager,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    public function getUserBadgeFrom(#[\SensitiveParameter] string $accessToken): UserBadge
    {
        $token = $this->tokenManager->findValid($accessToken);

        if (null === $token) {
            throw new BadCredentialsException('Invalid or expired access token.');
        }

        $user = $token->getUser();

        // At most one write per SEEN_PRECISION, not one per request.
        if ($user->markSeen(new \DateTimeImmutable())) {
            $this->entityManager->flush();
        }

        return new UserBadge($user->getUserIdentifier(), static fn () => $user);
    }
}
