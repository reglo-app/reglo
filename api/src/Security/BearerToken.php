<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\Request;

/**
 * Plain access token of the request ("Authorization: Bearer <token>").
 */
final class BearerToken
{
    public static function fromRequest(Request $request): ?string
    {
        $authorization = (string) $request->headers->get('Authorization');

        return 1 === preg_match('/^Bearer\s+(\S+)$/i', $authorization, $matches) ? $matches[1] : null;
    }
}
