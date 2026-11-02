<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'app_user')]
#[ORM\UniqueConstraint(name: 'uniq_app_user_email', columns: ['email'])]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    public const MAX_NAME_LENGTH = 100;
    public const MAX_JOB_TITLE_LENGTH = 100;
    public const MAX_EMAIL_LENGTH = 180;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: self::MAX_EMAIL_LENGTH)]
    private string $email;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $roles = [];

    #[ORM\Column]
    private string $password = '';

    #[ORM\Column(length: self::MAX_NAME_LENGTH, nullable: true)]
    private ?string $firstName = null;

    #[ORM\Column(length: self::MAX_NAME_LENGTH, nullable: true)]
    private ?string $lastName = null;

    /** Job title shown to the team, e.g. "Responsable QHSE". */
    #[ORM\Column(length: self::MAX_JOB_TITLE_LENGTH, nullable: true)]
    private ?string $jobTitle = null;

    /**
     * Random file name of the profile photo in the uploads folder (see
     * AvatarStorage). Never sent to clients.
     */
    #[ORM\Column(length: 64, nullable: true)]
    private ?string $avatarFile = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $avatarUpdatedAt = null;

    /**
     * Null for platform administrators (REGLO team), who belong to no client.
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(onDelete: 'CASCADE')]
    private ?Organization $organization = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    /**
     * Set when the user has chosen their password. Until then they cannot
     * log in.
     */
    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $activatedAt = null;

    public function __construct(string $email)
    {
        $this->email = self::normalizeEmail($email);
        $this->createdAt = new \DateTimeImmutable();
    }

    /**
     * E-mails are stored in lowercase so that login is case-insensitive.
     */
    public static function normalizeEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    /**
     * Only once the new address is confirmed (see EmailChangeManager).
     */
    public function changeEmail(string $email): static
    {
        $this->email = self::normalizeEmail($email);

        return $this;
    }

    /**
     * @return non-empty-string
     */
    public function getUserIdentifier(): string
    {
        if ('' === $this->email) {
            throw new \LogicException('A user must have an e-mail.');
        }

        return $this->email;
    }

    /**
     * @return list<string>
     */
    public function getRoles(): array
    {
        $roles = $this->roles;
        $roles[] = 'ROLE_USER';

        return array_values(array_unique($roles));
    }

    /**
     * @param list<string> $roles
     */
    public function setRoles(array $roles): static
    {
        $this->roles = $roles;

        return $this;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $hashedPassword): static
    {
        $this->password = $hashedPassword;

        return $this;
    }

    public function getFirstName(): ?string
    {
        return $this->firstName;
    }

    public function getLastName(): ?string
    {
        return $this->lastName;
    }

    public function setName(string $firstName, string $lastName): static
    {
        $this->firstName = trim($firstName);
        $this->lastName = trim($lastName);

        return $this;
    }

    public function getJobTitle(): ?string
    {
        return $this->jobTitle;
    }

    /**
     * An empty title is stored as null.
     */
    public function setJobTitle(?string $jobTitle): static
    {
        $jobTitle = trim((string) $jobTitle);
        $this->jobTitle = '' === $jobTitle ? null : $jobTitle;

        return $this;
    }

    public function getAvatarFile(): ?string
    {
        return $this->avatarFile;
    }

    public function getAvatarUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->avatarUpdatedAt;
    }

    /**
     * Null removes the photo. The date changes the photo URL, so browsers
     * never show an old one from their cache.
     */
    public function setAvatarFile(?string $avatarFile): static
    {
        $this->avatarFile = $avatarFile;
        $this->avatarUpdatedAt = null === $avatarFile ? null : new \DateTimeImmutable();

        return $this;
    }

    public function getOrganization(): ?Organization
    {
        return $this->organization;
    }

    public function setOrganization(?Organization $organization): static
    {
        $this->organization = $organization;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getActivatedAt(): ?\DateTimeImmutable
    {
        return $this->activatedAt;
    }

    public function isActivated(): bool
    {
        return null !== $this->activatedAt;
    }

    /**
     * Sets the chosen password and allows the user to log in.
     */
    public function activate(string $hashedPassword): static
    {
        $this->password = $hashedPassword;
        $this->activatedAt ??= new \DateTimeImmutable();

        return $this;
    }

    #[\Deprecated]
    public function eraseCredentials(): void
    {
    }
}
