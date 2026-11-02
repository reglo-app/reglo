<?php

namespace App\Tenant;

use App\Entity\Organization;

/**
 * Business data that belongs to one organization (tenant isolation, rule 1).
 *
 * Entities implementing it are filtered on the organization of the logged-in
 * user in every ORM query, and get that organization when created through
 * the API. Use OrganizationOwnedTrait for the mapping, and add the entity to
 * the isolation tests (tests/Tenant/TenantIsolationTest.php).
 */
interface OrganizationOwnedInterface
{
    /**
     * Null only before the first flush: the column is not nullable.
     */
    public function getOrganization(): ?Organization;

    public function setOrganization(Organization $organization): void;
}
