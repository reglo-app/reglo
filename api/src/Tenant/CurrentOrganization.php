<?php

namespace App\Tenant;

use App\Entity\Organization;
use App\Entity\User;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Organization of the logged-in user. Null when nobody is logged in
 * (public routes, console) and for platform administrators.
 */
final class CurrentOrganization
{
    public function __construct(
        private readonly Security $security,
    ) {
    }

    public function get(): ?Organization
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user->getOrganization() : null;
    }
}
