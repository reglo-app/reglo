<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;

/**
 * Same generic message whether the e-mail or the password is wrong, so the
 * response never tells if an account exists. A throttled IP gets its own
 * message, without any retry delay.
 */
final class LoginFailureHandler implements AuthenticationFailureHandlerInterface
{
    public const MESSAGE = 'Identifiants incorrects';
    public const THROTTLED_MESSAGE = 'Trop de tentatives de connexion. Réessayez dans quelques minutes.';

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): JsonResponse
    {
        if ($exception instanceof TooManyLoginAttemptsAuthenticationException) {
            return new JsonResponse(['error' => self::THROTTLED_MESSAGE], Response::HTTP_TOO_MANY_REQUESTS);
        }

        return new JsonResponse(['error' => self::MESSAGE], Response::HTTP_UNAUTHORIZED);
    }
}
