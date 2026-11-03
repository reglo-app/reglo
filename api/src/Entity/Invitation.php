<?php

namespace App\Entity;

use App\Repository\InvitationRepository;
use App\Tenant\OrganizationOwnedInterface;
use App\Tenant\OrganizationOwnedTrait;
use Doctrine\ORM\Mapping as ORM;

/**
 * Pending invitation of a collaborator to an organization (US-03). The link
 * of the e-mail holds a single-use token, of which only the SHA-256 hash is
 * stored. Deleted once accepted or cancelled.
 */
#[ORM\Entity(repositoryClass: InvitationRepository::class)]
#[ORM\Table(name: 'invitation')]
#[ORM\UniqueConstraint(name: 'uniq_invitation_token_hash', columns: ['token_hash'])]
#[ORM\UniqueConstraint(name: 'uniq_invitation_organization_email', columns: ['organization_id', 'email'])]
class Invitation implements OrganizationOwnedInterface
{
    use OrganizationOwnedTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: User::MAX_EMAIL_LENGTH)]
    private string $email;

    /** Optional: the invited person can type or correct it when accepting. */
    #[ORM\Column(length: User::MAX_NAME_LENGTH, nullable: true)]
    private ?string $firstName = null;

    #[ORM\Column(length: User::MAX_NAME_LENGTH, nullable: true)]
    private ?string $lastName = null;

    /** Given to the account created when the invitation is accepted. */
    #[ORM\Column(length: 16, enumType: OrganizationRole::class, options: ['default' => 'member'])]
    private OrganizationRole $role = OrganizationRole::Member;

    /** Null once the administrator who invited has left. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(onDelete: 'SET NULL')]
    private ?User $invitedBy;

    #[ORM\Column(length: 64)]
    private string $tokenHash;

    /** Date of the last sending: changes when the invitation is sent again. */
    #[ORM\Column]
    private \DateTimeImmutable $sentAt;

    #[ORM\Column]
    private \DateTimeImmutable $expiresAt;

    public function __construct(Organization $organization, string $email, User $invitedBy)
    {
        $this->setOrganization($organization);
        $this->email = User::normalizeEmail($email);
        $this->invitedBy = $invitedBy;
        $this->sentAt = new \DateTimeImmutable();
        $this->expiresAt = $this->sentAt;
        $this->tokenHash = '';
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getFirstName(): ?string
    {
        return $this->firstName;
    }

    public function getLastName(): ?string
    {
        return $this->lastName;
    }

    /**
     * Empty names are stored as null.
     */
    public function setName(?string $firstName, ?string $lastName): static
    {
        $this->firstName = '' === trim((string) $firstName) ? null : trim((string) $firstName);
        $this->lastName = '' === trim((string) $lastName) ? null : trim((string) $lastName);

        return $this;
    }

    public function getRole(): OrganizationRole
    {
        return $this->role;
    }

    public function setRole(OrganizationRole $role): static
    {
        $this->role = $role;

        return $this;
    }

    public function getInvitedBy(): ?User
    {
        return $this->invitedBy;
    }

    public function getTokenHash(): string
    {
        return $this->tokenHash;
    }

    /**
     * New link (first sending or sending again): the previous one stops
     * working.
     */
    public function renew(string $tokenHash, \DateTimeImmutable $expiresAt): static
    {
        $this->tokenHash = $tokenHash;
        $this->sentAt = new \DateTimeImmutable();
        $this->expiresAt = $expiresAt;

        return $this;
    }

    public function getSentAt(): \DateTimeImmutable
    {
        return $this->sentAt;
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
