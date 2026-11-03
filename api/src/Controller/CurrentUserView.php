<?php

namespace App\Controller;

use App\Entity\User;

/**
 * The signed-in user as sent to the web app: shape of CurrentUser in
 * web/src/lib/api/types.ts.
 */
final class CurrentUserView
{
    /**
     * @return array<string, mixed>
     */
    public static function of(User $user): array
    {
        $organization = $user->getOrganization();

        return [
            'id' => (string) $user->getId(),
            'email' => $user->getEmail(),
            'firstName' => $user->getFirstName(),
            'lastName' => $user->getLastName(),
            'jobTitle' => $user->getJobTitle(),
            // Changes with each new photo; null without photo
            'avatarVersion' => $user->getAvatarUpdatedAt()?->format('U'),
            'role' => self::roleKey($user),
            // Null for accounts outside any client (REGLO team)
            'organization' => null === $organization ? null : [
                'id' => (string) $organization->getId(),
                'name' => $organization->getName(),
            ],
        ];
    }

    /**
     * Role key of the web app: "admin", "member" (default) or "reader".
     */
    public static function roleKey(User $user): string
    {
        $roles = $user->getRoles();

        return match (true) {
            \in_array('ROLE_ADMIN', $roles, true) => 'admin',
            \in_array('ROLE_READER', $roles, true) => 'reader',
            default => 'member',
        };
    }
}
