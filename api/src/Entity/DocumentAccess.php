<?php

namespace App\Entity;

use App\Repository\DocumentAccessRepository;
use App\Tenant\OrganizationOwnedInterface;
use App\Tenant\OrganizationOwnedTrait;
use Doctrine\ORM\Mapping as ORM;

/**
 * Who opened a document, and when (US-12): the access log that the
 * administrators of the organization consult. Kept as long as the document;
 * personal data, listed in the processing register.
 */
#[ORM\Entity(repositoryClass: DocumentAccessRepository::class)]
#[ORM\Table(name: 'document_access')]
#[ORM\Index(name: 'idx_document_access_document', columns: ['document_id', 'accessed_at'])]
class DocumentAccess implements OrganizationOwnedInterface
{
    use OrganizationOwnedTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Document $document;

    /** Null once the member has left the organization. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(onDelete: 'SET NULL')]
    private ?User $accessedBy;

    #[ORM\Column(length: 16, enumType: DocumentAccessKind::class)]
    private DocumentAccessKind $kind;

    #[ORM\Column]
    private \DateTimeImmutable $accessedAt;

    public function __construct(Document $document, User $accessedBy, DocumentAccessKind $kind)
    {
        $organization = $document->getOrganization();
        \assert(null !== $organization);
        $this->setOrganization($organization);
        $this->document = $document;
        $this->accessedBy = $accessedBy;
        $this->kind = $kind;
        $this->accessedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getDocument(): Document
    {
        return $this->document;
    }

    public function getAccessedBy(): ?User
    {
        return $this->accessedBy;
    }

    public function getKind(): DocumentAccessKind
    {
        return $this->kind;
    }

    public function getAccessedAt(): \DateTimeImmutable
    {
        return $this->accessedAt;
    }
}
