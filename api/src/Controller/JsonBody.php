<?php

namespace App\Controller;

use Symfony\Component\HttpFoundation\Exception\JsonException;
use Symfony\Component\HttpFoundation\Request;

/**
 * Reads fields of a JSON request body.
 */
final class JsonBody
{
    /**
     * A string field; anything else (missing field, number, invalid JSON)
     * gives an empty string.
     */
    public static function string(Request $request, string $name): string
    {
        try {
            $value = $request->toArray()[$name] ?? '';
        } catch (JsonException) {
            return '';
        }

        return \is_string($value) ? $value : '';
    }
}
