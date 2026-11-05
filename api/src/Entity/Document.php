<?php

namespace App\Entity;

use App\Repository\DocumentRepository;
use App\Tenant\OrganizationOwnedInterface;
use App\Tenant\OrganizationOwnedTrait;
use Doctrine\ORM\Mapping as ORM;

/**
 * Evidence uploaded by an organization (US-11): a DUERP, a report, a
 * certificate... The file is kept by DocumentStorage under a random name;
 * the original name is only metadata.
 */
#[ORM\Entity(repositoryClass: DocumentRepository::class)]
#[ORM\Table(name: 'document')]
#[ORM\Index(name: 'idx_document_created_at', columns: ['organization_id', 'created_at'])]
class Document implements OrganizationOwnedInterface
{
    use OrganizationOwnedTrait;

    public const ORIGINAL_NAME_MAX_LENGTH = 255;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: self::ORIGINAL_NAME_MAX_LENGTH)]
    private string $originalName;

    /** Random name of the file in the storage: never sent to the client. */
    #[ORM\Column(length: 32, unique: true)]
    private string $storedName;

    /** The type found in the content, not the one sent by the client. */
    #[ORM\Column(length: 100)]
    private string $mimeType;

    /** In bytes. */
    #[ORM\Column]
    private int $size;

    #[ORM\Column(length: 16, nullable: true, enumType: QhsePillar::class)]
    private ?QhsePillar $pillar;

    /** Null once the member has left the organization. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(onDelete: 'SET NULL')]
    private ?User $uploadedBy;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(
        Organization $organization,
        string $originalName,
        string $storedName,
        string $mimeType,
        int $size,
        ?QhsePillar $pillar,
        User $uploadedBy,
    ) {
        $this->setOrganization($organization);
        $this->originalName = $originalName;
        $this->storedName = $storedName;
        $this->mimeType = $mimeType;
        $this->size = $size;
        $this->pillar = $pillar;
        $this->uploadedBy = $uploadedBy;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOriginalName(): string
    {
        return $this->originalName;
    }

    public function getStoredName(): string
    {
        return $this->storedName;
    }

    public function getMimeType(): string
    {
        return $this->mimeType;
    }

    public function getSize(): int
    {
        return $this->size;
    }

    public function getPillar(): ?QhsePillar
    {
        return $this->pillar;
    }

    public function getUploadedBy(): ?User
    {
        return $this->uploadedBy;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
