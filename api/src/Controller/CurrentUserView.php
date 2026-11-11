<?php

namespace App\Controller;

use App\Entity\OrganizationRole;
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
            // Without an organization nothing can be changed (no ROLE_MEMBER,
            // see User::getRoles()): the web app hides the buttons as for a reader.
            'role' => (null === $organization ? OrganizationRole::Reader : $user->getOrganizationRole())->value,
            // REGLO team: the web app opens the back office for them
            'platformAdmin' => $user->isPlatformAdmin(),
            // Null for accounts outside any client (REGLO team)
            'organization' => null === $organization ? null : [
                'id' => (string) $organization->getId(),
                'name' => $organization->getName(),
            ],
        ];
    }
}
