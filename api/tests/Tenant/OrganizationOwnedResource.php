<?php

namespace App\Tests\Tenant;

use App\Entity\Organization;
use App\Tenant\OrganizationOwnedInterface;

/**
 * How the isolation tests use one API resource owned by an organization.
 */
final class OrganizationOwnedResource
{
    /**
     * @param class-string<OrganizationOwnedInterface>           $class
     * @param string                                             $uri           collection URI, items are "$uri/{id}"
     * @param \Closure(Organization): OrganizationOwnedInterface $create        builds a valid entity in an organization (not persisted)
     * @param array<string, mixed>                               $createPayload valid body of a POST
     * @param array<string, mixed>                               $updatePayload valid body of a PATCH
     */
    public function __construct(
        public readonly string $class,
        public readonly string $uri,
        public readonly \Closure $create,
        public readonly array $createPayload,
        public readonly array $updatePayload,
    ) {
    }
}
