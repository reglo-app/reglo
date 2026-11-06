<?php

namespace App\Platform;

use App\Entity\AdminAction;
use App\Entity\AdminAuditEntry;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Keeps track of what the REGLO team does in the back office.
 */
final class AdminAuditLog
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * Written directly, not with flush(): after a deletion, the entity
     * manager may still hold entities linked to what the database removed in
     * cascade, and flush() would refuse them.
     */
    public function record(User $actor, AdminAction $action, string $target): void
    {
        $entry = new AdminAuditEntry($actor->getEmail(), $action, $target);

        $this->entityManager->getConnection()->insert('admin_audit_entry', [
            'actor_email' => $entry->getActorEmail(),
            'action' => $entry->getAction()->value,
            'target' => $entry->getTarget(),
            'created_at' => $entry->getCreatedAt()->format('Y-m-d H:i:s'),
        ]);
    }
}
