<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;

/**
 * Same generic message whether the e-mail or the password is wrong, so the
 * response never tells if an account exists.
 */
final class LoginFailureHandler implements AuthenticationFailureHandlerInterface
{
    public const MESSAGE = 'Identifiants incorrects';

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): JsonResponse
    {
        return new JsonResponse(['error' => self::MESSAGE], Response::HTTP_UNAUTHORIZED);
    }
}
