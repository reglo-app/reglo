<?php

namespace App\Entity;

use App\Repository\DiagnosticRepository;
use App\Tenant\OrganizationOwnedInterface;
use App\Tenant\OrganizationOwnedTrait;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * QHSE diagnostic of an organization (US-05). At most one draft per
 * organization, shared by all its members; once submitted it is kept
 * unchanged (the score of US-06 is computed from it).
 */
#[ORM\Entity(repositoryClass: DiagnosticRepository::class)]
#[ORM\Table(name: 'diagnostic')]
// One draft per organization. The condition is written as PostgreSQL stores
// it, or doctrine:schema:validate would always see a difference.
#[ORM\UniqueConstraint(name: 'uniq_diagnostic_draft', columns: ['organization_id'], options: ['where' => "((status)::text = 'draft'::text)"])]
class Diagnostic implements OrganizationOwnedInterface
{
    use OrganizationOwnedTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 16, enumType: DiagnosticStatus::class)]
    private DiagnosticStatus $status = DiagnosticStatus::Draft;

    /** Version of the questionnaire answered (see Questionnaire). */
    #[ORM\Column(length: 64)]
    private string $questionnaireVersion;

    /** Null once the member who started it has left. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(onDelete: 'SET NULL')]
    private ?User $startedBy;

    #[ORM\Column]
    private \DateTimeImmutable $startedAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $submittedAt = null;

    /**
     * Score computed by the data service at the submission (US-06): global,
     * maturity, pillars, themes, coverage, gaps, algoVersion.
     *
     * @var array<string, mixed>|null
     */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $score = null;

    /** @var Collection<string, DiagnosticAnswer> by question id */
    #[ORM\OneToMany(targetEntity: DiagnosticAnswer::class, mappedBy: 'diagnostic', cascade: ['persist'], orphanRemoval: true, indexBy: 'questionId')]
    private Collection $answers;

    public function __construct(Organization $organization, string $questionnaireVersion, User $startedBy)
    {
        $this->setOrganization($organization);
        $this->questionnaireVersion = $questionnaireVersion;
        $this->startedBy = $startedBy;
        $this->startedAt = new \DateTimeImmutable();
        $this->updatedAt = $this->startedAt;
        $this->answers = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getStatus(): DiagnosticStatus
    {
        return $this->status;
    }

    public function getQuestionnaireVersion(): string
    {
        return $this->questionnaireVersion;
    }

    public function getStartedBy(): ?User
    {
        return $this->startedBy;
    }

    public function getStartedAt(): \DateTimeImmutable
    {
        return $this->startedAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function getSubmittedAt(): ?\DateTimeImmutable
    {
        return $this->submittedAt;
    }

    /**
     * @return Collection<string, DiagnosticAnswer>
     */
    public function getAnswers(): Collection
    {
        return $this->answers;
    }

    /**
     * Sets the answer to a question (null value and not applicable false:
     * the answer is removed).
     */
    public function answer(string $questionId, mixed $value, bool $notApplicable, User $by): void
    {
        $this->updatedAt = new \DateTimeImmutable();

        if (null === $value && !$notApplicable) {
            $this->answers->remove($questionId);

            return;
        }

        $answer = $this->answers->get($questionId);
        if (null === $answer) {
            $this->answers->set($questionId, new DiagnosticAnswer($this, $questionId, $value, $notApplicable, $by));

            return;
        }

        $answer->change($value, $notApplicable, $by);
    }

    /**
     * @param list<string> $mandatoryIds
     *
     * @return list<string> mandatory questions without answer
     */
    public function missingAnswers(array $mandatoryIds): array
    {
        return array_values(array_filter($mandatoryIds, fn (string $id): bool => !$this->answers->containsKey($id)));
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getScore(): ?array
    {
        return $this->score;
    }

    /**
     * Validated with its score: from then on, it no longer changes.
     *
     * @param array<string, mixed> $score
     */
    public function submit(array $score): void
    {
        $this->score = $score;
        $this->status = DiagnosticStatus::Submitted;
        $this->submittedAt = new \DateTimeImmutable();
        $this->updatedAt = $this->submittedAt;
    }
}
