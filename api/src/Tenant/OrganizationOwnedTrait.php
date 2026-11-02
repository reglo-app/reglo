<?php

namespace App\Tenant;

use ApiPlatform\Metadata\ApiProperty;
use App\Entity\Organization;
use Doctrine\ORM\Mapping as ORM;

/**
 * Mapping of OrganizationOwnedInterface. The property must stay named
 * "organization": OrganizationFilter relies on it.
 */
trait OrganizationOwnedTrait
{
    /**
     * Never read nor written through the API: the client never chooses it,
     * OrganizationAssignmentListener sets it.
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[ApiProperty(readable: false, writable: false)]
    private ?Organization $organization = null;

    public function getOrganization(): ?Organization
    {
        return $this->organization;
    }

    public function setOrganization(Organization $organization): void
    {
        $this->organization = $organization;
    }
}
