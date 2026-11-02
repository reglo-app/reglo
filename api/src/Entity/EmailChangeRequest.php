<?php

namespace App\Entity;

use App\Repository\EmailChangeRequestRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * New e-mail address waiting for confirmation: the link is sent to that
 * address, and the account e-mail only changes once it is opened. Only the
 * SHA-256 hash of the token is stored; the request is deleted once used.
 */
#[ORM\Entity(repositoryClass: EmailChangeRequestRepository::class)]
#[ORM\Table(name: 'email_change_request')]
#[ORM\UniqueConstraint(name: 'uniq_email_change_request_hash', columns: ['token_hash'])]
class EmailChangeRequest
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(length: User::MAX_EMAIL_LENGTH)]
    private string $newEmail;

    #[ORM\Column(length: 64)]
    private string $tokenHash;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $expiresAt;

    public function __construct(User $user, string $newEmail, string $tokenHash, \DateTimeImmutable $expiresAt)
    {
        $this->user = $user;
        $this->newEmail = User::normalizeEmail($newEmail);
        $this->tokenHash = $tokenHash;
        $this->createdAt = new \DateTimeImmutable();
        $this->expiresAt = $expiresAt;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getNewEmail(): string
    {
        return $this->newEmail;
    }

    public function getTokenHash(): string
    {
        return $this->tokenHash;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getExpiresAt(): \DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function isExpired(?\DateTimeImmutable $now = null): bool
    {
        return ($now ?? new \DateTimeImmutable()) >= $this->expiresAt;
    }
}
