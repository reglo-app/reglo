<?php

namespace App\Controller;

use App\Entity\User;
use App\Security\AccessTokenManager;
use App\Security\BearerToken;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api/auth', name: 'auth_')]
final class AuthController
{
    /**
     * Handled by the json_login authenticator of the "login" firewall
     * (see LoginSuccessHandler and LoginFailureHandler). This method is only
     * reached when the request is not sent as JSON.
     */
    #[Route('/login', name: 'login', methods: ['POST'])]
    public function login(): JsonResponse
    {
        return new JsonResponse(['error' => 'Requête invalide.'], Response::HTTP_BAD_REQUEST);
    }

    /**
     * Deletes the access token of the request: it stops working at once
     * instead of at its expiry date.
     */
    #[Route('/logout', name: 'logout', methods: ['POST'])]
    public function logout(Request $request, AccessTokenManager $tokenManager): Response
    {
        // The firewall already authenticated the request with this header
        $token = BearerToken::fromRequest($request);

        if (null !== $token) {
            $tokenManager->revoke($token);
        }

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    #[Route('/me', name: 'me', methods: ['GET'])]
    public function me(#[CurrentUser] User $user): JsonResponse
    {
        return new JsonResponse(CurrentUserView::of($user));
    }
}
