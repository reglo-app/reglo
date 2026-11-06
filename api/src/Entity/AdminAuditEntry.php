<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * One action of the REGLO team in the back office: who, what, on whom, when.
 * Plain text and no relation on purpose: an entry must outlive the
 * organization or the account it talks about.
 */
#[ORM\Entity]
#[ORM\Table(name: 'admin_audit_entry')]
#[ORM\Index(name: 'idx_admin_audit_entry_created_at', columns: ['created_at'])]
class AdminAuditEntry
{
    public const MAX_TARGET_LENGTH = 400;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: User::MAX_EMAIL_LENGTH)]
    private string $actorEmail;

    #[ORM\Column(length: 32, enumType: AdminAction::class)]
    private AdminAction $action;

    #[ORM\Column(length: self::MAX_TARGET_LENGTH)]
    private string $target;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(string $actorEmail, AdminAction $action, string $target)
    {
        $this->actorEmail = $actorEmail;
        $this->action = $action;
        $this->target = mb_substr($target, 0, self::MAX_TARGET_LENGTH);
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getActorEmail(): string
    {
        return $this->actorEmail;
    }

    public function getAction(): AdminAction
    {
        return $this->action;
    }

    public function getTarget(): string
    {
        return $this->target;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
