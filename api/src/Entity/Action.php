<?php

namespace App\Entity;

use App\Repository\ActionRepository;
use App\Tenant\OrganizationOwnedInterface;
use App\Tenant\OrganizationOwnedTrait;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Action of the action plan of an organization (US-09): a concrete task on
 * one QHSE pillar, given to a member, with a due date. Its status changes
 * are kept (ActionStatusChange).
 */
#[ORM\Entity(repositoryClass: ActionRepository::class)]
// "action" is an SQL keyword.
#[ORM\Table(name: 'qhse_action')]
#[ORM\Index(name: 'idx_qhse_action_due_date', columns: ['organization_id', 'due_date'])]
class Action implements OrganizationOwnedInterface
{
    use OrganizationOwnedTrait;

    public const TITLE_MAX_LENGTH = 120;
    public const DESCRIPTION_MAX_LENGTH = 2000;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: self::TITLE_MAX_LENGTH)]
    private string $title;

    #[ORM\Column(type: Types::TEXT)]
    private string $description;

    #[ORM\Column(length: 16, enumType: QhsePillar::class)]
    private QhsePillar $pillar;

    #[ORM\Column(length: 16, enumType: ActionType::class)]
    private ActionType $type;

    #[ORM\Column(length: 16, enumType: ActionStatus::class)]
    private ActionStatus $status = ActionStatus::Todo;

    #[ORM\Column(type: Types::DATE_IMMUTABLE)]
    private \DateTimeImmutable $dueDate;

    /**
     * Required when the action is saved; null once the member has left the
     * organization, until it is given to someone else.
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(onDelete: 'SET NULL')]
    private ?User $assignee;

    /** Null once the member has left the organization. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(onDelete: 'SET NULL')]
    private ?User $createdBy;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    /** @var Collection<int, ActionStatusChange> oldest first */
    #[ORM\OneToMany(targetEntity: ActionStatusChange::class, mappedBy: 'action', cascade: ['persist'])]
    #[ORM\OrderBy(['changedAt' => 'ASC', 'id' => 'ASC'])]
    private Collection $statusChanges;

    public function __construct(
        Organization $organization,
        string $title,
        string $description,
        QhsePillar $pillar,
        ActionType $type,
        \DateTimeImmutable $dueDate,
        User $assignee,
        User $createdBy,
    ) {
        $this->setOrganization($organization);
        $this->title = $title;
        $this->description = $description;
        $this->pillar = $pillar;
        $this->type = $type;
        $this->dueDate = $dueDate;
        $this->assignee = $assignee;
        $this->createdBy = $createdBy;
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = $this->createdAt;
        $this->statusChanges = new ArrayCollection([new ActionStatusChange($this, null, $this->status, $createdBy)]);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getPillar(): QhsePillar
    {
        return $this->pillar;
    }

    public function getType(): ActionType
    {
        return $this->type;
    }

    public function getStatus(): ActionStatus
    {
        return $this->status;
    }

    public function getDueDate(): \DateTimeImmutable
    {
        return $this->dueDate;
    }

    public function getAssignee(): ?User
    {
        return $this->assignee;
    }

    public function getCreatedBy(): ?User
    {
        return $this->createdBy;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    /**
     * @return Collection<int, ActionStatusChange>
     */
    public function getStatusChanges(): Collection
    {
        return $this->statusChanges;
    }

    public function change(
        string $title,
        string $description,
        QhsePillar $pillar,
        ActionType $type,
        \DateTimeImmutable $dueDate,
        User $assignee,
    ): void {
        $this->title = $title;
        $this->description = $description;
        $this->pillar = $pillar;
        $this->type = $type;
        $this->dueDate = $dueDate;
        $this->assignee = $assignee;
        $this->updatedAt = new \DateTimeImmutable();
    }

    /**
     * Moves the action one step (checked by the caller with
     * ActionStatus::canMoveTo()) and keeps it in the history.
     */
    public function moveTo(ActionStatus $status, User $by): void
    {
        $this->statusChanges->add(new ActionStatusChange($this, $this->status, $status, $by));
        $this->status = $status;
        $this->updatedAt = new \DateTimeImmutable();
    }
}
