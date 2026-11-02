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

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
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
