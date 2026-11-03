<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Answer to one question of a diagnostic. Its organization is the one of
 * its diagnostic: it is only read through it (filtered by organization).
 */
#[ORM\Entity]
#[ORM\Table(name: 'diagnostic_answer')]
#[ORM\UniqueConstraint(name: 'uniq_diagnostic_answer_question', columns: ['diagnostic_id', 'question_id'])]
class DiagnosticAnswer
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'answers')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Diagnostic $diagnostic;

    #[ORM\Column(length: 100)]
    private string $questionId;

    /** In the format of the score computation (see Questionnaire). */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private mixed $value;

    #[ORM\Column]
    private bool $notApplicable;

    /** Null once the member who answered has left. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(onDelete: 'SET NULL')]
    private ?User $answeredBy;

    #[ORM\Column]
    private \DateTimeImmutable $answeredAt;

    public function __construct(Diagnostic $diagnostic, string $questionId, mixed $value, bool $notApplicable, User $answeredBy)
    {
        $this->diagnostic = $diagnostic;
        $this->questionId = $questionId;
        $this->change($value, $notApplicable, $answeredBy);
    }

    public function change(mixed $value, bool $notApplicable, User $answeredBy): void
    {
        $this->value = $notApplicable ? null : $value;
        $this->notApplicable = $notApplicable;
        $this->answeredBy = $answeredBy;
        $this->answeredAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getDiagnostic(): Diagnostic
    {
        return $this->diagnostic;
    }

    public function getQuestionId(): string
    {
        return $this->questionId;
    }

    public function getValue(): mixed
    {
        return $this->value;
    }

    public function isNotApplicable(): bool
    {
        return $this->notApplicable;
    }

    public function getAnsweredBy(): ?User
    {
        return $this->answeredBy;
    }

    public function getAnsweredAt(): \DateTimeImmutable
    {
        return $this->answeredAt;
    }
}
