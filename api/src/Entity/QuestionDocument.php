<?php

namespace App\Entity;

use App\Repository\QuestionDocumentRepository;
use App\Tenant\OrganizationOwnedInterface;
use App\Tenant\OrganizationOwnedTrait;
use Doctrine\ORM\Mapping as ORM;

/**
 * A document that proves a question of the diagnostic (US-12), for its
 * organization: it stays from one diagnostic to the next. The score of a
 * question that requires a proof is no longer capped once it has one.
 */
#[ORM\Entity(repositoryClass: QuestionDocumentRepository::class)]
#[ORM\Table(name: 'question_document')]
#[ORM\UniqueConstraint(name: 'uniq_question_document', columns: ['document_id', 'question_id'])]
#[ORM\Index(name: 'idx_question_document_question', columns: ['organization_id', 'question_id'])]
class QuestionDocument implements OrganizationOwnedInterface
{
    use OrganizationOwnedTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'questionLinks')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Document $document;

    /** Id of the question in the questionnaire, e.g. "safety.risques.01". */
    #[ORM\Column(length: 100)]
    private string $questionId;

    /** Null once the member has left the organization. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(onDelete: 'SET NULL')]
    private ?User $linkedBy;

    #[ORM\Column]
    private \DateTimeImmutable $linkedAt;

    public function __construct(Document $document, string $questionId, User $linkedBy)
    {
        $organization = $document->getOrganization();
        \assert(null !== $organization);
        $this->setOrganization($organization);
        $this->document = $document;
        $this->questionId = $questionId;
        $this->linkedBy = $linkedBy;
        $this->linkedAt = new \DateTimeImmutable();
        $document->getQuestionLinks()->add($this);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getDocument(): Document
    {
        return $this->document;
    }

    public function getQuestionId(): string
    {
        return $this->questionId;
    }

    public function getLinkedBy(): ?User
    {
        return $this->linkedBy;
    }

    public function getLinkedAt(): \DateTimeImmutable
    {
        return $this->linkedAt;
    }
}
