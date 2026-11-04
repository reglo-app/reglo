<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * One step of the history of an action (US-09): who moved it, when, from
 * which status to which. The first one, without previous status, is the
 * creation.
 */
#[ORM\Entity]
#[ORM\Table(name: 'action_status_change')]
class ActionStatusChange
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'statusChanges')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Action $action;

    #[ORM\Column(length: 16, nullable: true, enumType: ActionStatus::class)]
    private ?ActionStatus $fromStatus;

    #[ORM\Column(length: 16, enumType: ActionStatus::class)]
    private ActionStatus $toStatus;

    /** Null once the member has left the organization. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(onDelete: 'SET NULL')]
    private ?User $changedBy;

    #[ORM\Column]
    private \DateTimeImmutable $changedAt;

    public function __construct(Action $action, ?ActionStatus $fromStatus, ActionStatus $toStatus, User $changedBy)
    {
        $this->action = $action;
        $this->fromStatus = $fromStatus;
        $this->toStatus = $toStatus;
        $this->changedBy = $changedBy;
        $this->changedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getAction(): Action
    {
        return $this->action;
    }

    public function getFromStatus(): ?ActionStatus
    {
        return $this->fromStatus;
    }

    public function getToStatus(): ActionStatus
    {
        return $this->toStatus;
    }

    public function getChangedBy(): ?User
    {
        return $this->changedBy;
    }

    public function getChangedAt(): \DateTimeImmutable
    {
        return $this->changedAt;
    }
}
