<?php

namespace App\Entity;

use App\Repository\OrganizationRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * A client company. Every piece of business data belongs to exactly one
 * organization and must never be visible from another one.
 */
#[ORM\Entity(repositoryClass: OrganizationRepository::class)]
#[ORM\Table(name: 'organization')]
#[ORM\UniqueConstraint(name: 'uniq_organization_name', columns: ['name'])]
class Organization
{
    public const MAX_NAME_LENGTH = 180;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: self::MAX_NAME_LENGTH)]
    private string $name;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(string $name)
    {
        $this->name = self::normalizeName($name);
        $this->createdAt = new \DateTimeImmutable();
    }

    /**
     * Trims and collapses inner spaces, so "  Acme   SAS " and "Acme SAS"
     * are the same organization.
     */
    public static function normalizeName(string $name): string
    {
        return (string) preg_replace('/\s+/u', ' ', trim($name));
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function rename(string $name): static
    {
        $this->name = self::normalizeName($name);

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
