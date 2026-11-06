<?php

namespace App\Controller\Admin;

use App\Entity\User;
use App\Platform\AccountProvisioner;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Answers shared by the back office routes. The messages are shown as is to
 * the REGLO team: in French, never a technical detail (rule 3).
 */
final class AdminResponse
{
    public const LAST_ADMIN = 'Cette organisation doit garder au moins un administrateur. Nommez d\'abord un autre administrateur.';
    public const INVALID_ROLE = 'Choisissez le rôle : administrateur, membre ou lecteur.';

    private const MESSAGES = [
        AccountProvisioner::NAME_INVALID => 'Saisissez le nom de l\'organisation (180 caractères au maximum).',
        AccountProvisioner::NAME_TAKEN => 'Une organisation porte déjà ce nom.',
        AccountProvisioner::EMAIL_INVALID => 'Saisissez une adresse e-mail valide.',
        AccountProvisioner::EMAIL_TAKEN => 'Un compte existe déjà avec cette adresse e-mail.',
        AccountProvisioner::FIRST_NAME_INVALID => 'Saisissez le prénom (100 caractères au maximum).',
        AccountProvisioner::LAST_NAME_INVALID => 'Saisissez le nom (100 caractères au maximum).',
    ];

    /**
     * @param array<string, string> $errors code of the problem by field
     */
    public static function invalidFields(array $errors): JsonResponse
    {
        $fields = array_map(static fn (string $code): string => self::MESSAGES[$code], $errors);

        return new JsonResponse([
            'error' => (string) reset($fields),
            'code' => 'invalid_input',
            'fields' => $fields,
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }

    public static function error(string $message, string $code): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'code' => $code], Response::HTTP_UNPROCESSABLE_ENTITY);
    }

    public static function notFound(string $message): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'code' => 'not_found'], Response::HTTP_NOT_FOUND);
    }

    /**
     * Shape of AdminUser in web/src/lib/api/types.ts: what the team needs to
     * manage an access, nothing more (rule 6).
     *
     * @return array<string, mixed>
     */
    public static function user(User $user): array
    {
        $organization = $user->getOrganization();

        return [
            'id' => (string) $user->getId(),
            'email' => $user->getEmail(),
            'firstName' => $user->getFirstName(),
            'lastName' => $user->getLastName(),
            'role' => $user->getOrganizationRole()->value,
            'activated' => $user->isActivated(),
            'joinedAt' => $user->getActivatedAt()?->format(\DATE_ATOM),
            'lastSeenAt' => $user->getLastSeenAt()?->format(\DATE_ATOM),
            'organization' => null === $organization ? null : [
                'id' => (string) $organization->getId(),
                'name' => $organization->getName(),
            ],
        ];
    }
}
