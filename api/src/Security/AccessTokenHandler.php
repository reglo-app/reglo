<?php

namespace App\Security;

use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Http\AccessToken\AccessTokenHandlerInterface;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;

/**
 * Authenticates API requests sent with "Authorization: Bearer <token>".
 */
final class AccessTokenHandler implements AccessTokenHandlerInterface
{
    public function __construct(private readonly AccessTokenManager $tokenManager)
    {
    }

    public function getUserBadgeFrom(#[\SensitiveParameter] string $accessToken): UserBadge
    {
        $token = $this->tokenManager->findValid($accessToken);

        if (null === $token) {
            throw new BadCredentialsException('Invalid or expired access token.');
        }

        $user = $token->getUser();

        return new UserBadge($user->getUserIdentifier(), static fn () => $user);
    }
}
