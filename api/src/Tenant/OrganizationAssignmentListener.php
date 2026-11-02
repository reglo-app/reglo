<?php

namespace App\Tenant;

use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PrePersistEventArgs;
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Events;

/**
 * The client never chooses the organization of what it writes: a new
 * OrganizationOwnedInterface entity gets the organization of the logged-in
 * user, whatever the request sent, and an existing one never moves to
 * another organization.
 */
#[AsDoctrineListener(event: Events::prePersist)]
#[AsDoctrineListener(event: Events::preUpdate)]
final class OrganizationAssignmentListener
{
    public function __construct(
        private readonly CurrentOrganization $currentOrganization,
    ) {
    }

    public function prePersist(PrePersistEventArgs $args): void
    {
        $entity = $args->getObject();
        $organization = $this->currentOrganization->get();

        // Without a logged-in organization (console), the caller sets it.
        if ($entity instanceof OrganizationOwnedInterface && null !== $organization) {
            $entity->setOrganization($organization);
        }
    }

    public function preUpdate(PreUpdateEventArgs $args): void
    {
        if ($args->getObject() instanceof OrganizationOwnedInterface && $args->hasChangedField('organization')) {
            $args->setNewValue('organization', $args->getOldValue('organization'));
        }
    }
}
