<?php

namespace App\Entity;

/**
 * Role of a user in their organization (US-16). The value is the key used
 * by the web app; each role maps to a Symfony role, and the hierarchy in
 * security.yaml gives an administrator the rights of a member, and a member
 * those of a reader.
 */
enum OrganizationRole: string
{
    /** Everything, including inviting and changing roles. */
    case Admin = 'admin';
    /** Fills in the diagnostic, manages actions and documents. */
    case Member = 'member';
    /** Consults only: every write is refused by the API. */
    case Reader = 'reader';

    public function securityRole(): string
    {
        return match ($this) {
            self::Admin => 'ROLE_ADMIN',
            self::Member => 'ROLE_MEMBER',
            self::Reader => 'ROLE_READER',
        };
    }

    /**
     * @return list<string>
     */
    public static function securityRoles(): array
    {
        return array_map(static fn (self $role): string => $role->securityRole(), self::cases());
    }
}
