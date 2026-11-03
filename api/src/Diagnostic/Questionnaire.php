<?php

namespace App\Diagnostic;

use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * The QHSE questionnaire of the diagnostic (US-05), read from a JSON file in
 * the format of the data service (questionnaire_example.json): pillars,
 * themes, questions. Replacing the file changes the questionnaire.
 */
final class Questionnaire
{
    public const MAX_TEXT_LENGTH = 2000;

    /** @var array<string, mixed>|null */
    private ?array $data = null;

    /** @var array<string, array<string, mixed>>|null questions by id */
    private ?array $questions = null;

    public function __construct(
        #[Autowire(param: 'app.questionnaire_file')]
        private readonly string $file,
    ) {
    }

    /**
     * The whole questionnaire, as sent to the web app.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        if (null === $this->data) {
            $data = json_decode((string) file_get_contents($this->file), true, flags: \JSON_THROW_ON_ERROR);
            if (!\is_array($data) || !\is_string($data['version'] ?? null) || !\is_array($data['pillars'] ?? null)) {
                throw new \UnexpectedValueException(\sprintf('Invalid questionnaire file "%s".', $this->file));
            }
            $this->data = $data;
        }

        return $this->data;
    }

    public function version(): string
    {
        $version = $this->toArray()['version'];
        \assert(\is_string($version));

        return $version;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function question(string $id): ?array
    {
        return $this->questions()[$id] ?? null;
    }

    /**
     * Ids of the questions to answer before submitting.
     *
     * @return list<string>
     */
    public function mandatoryIds(): array
    {
        return array_keys(array_filter(
            $this->questions(),
            static fn (array $question): bool => false !== ($question['mandatory'] ?? true),
        ));
    }

    /**
     * Checks an answer against its question, in the format of the score
     * computation: yes_no "yes" / "no" / "partial", scale level index,
     * single_choice option id, multi_choice list of option ids, text.
     *
     * @return string|null message for the user, null when valid
     */
    public function answerError(string $questionId, mixed $value, bool $notApplicable): ?string
    {
        $question = $this->question($questionId);
        if (null === $question) {
            return 'Cette question n\'existe pas.';
        }

        if ($notApplicable) {
            return true === ($question['allow_na'] ?? false) ? null : 'Cette question ne peut pas être marquée « non concerné ».';
        }

        $options = array_column(\is_array($question['options'] ?? null) ? $question['options'] : [], 'id');
        $valid = match ($question['type'] ?? null) {
            'yes_no' => \in_array($value, ['yes', 'no', 'partial'], true),
            'scale' => \is_int($value) && $value >= 0 && $value < \count(\is_array($question['levels'] ?? null) ? $question['levels'] : []),
            'single_choice' => \is_string($value) && \in_array($value, $options, true),
            'multi_choice' => \is_array($value) && array_is_list($value)
                && \count($value) === \count(array_unique($value))
                && [] === array_diff($value, $options),
            'text' => \is_string($value) && mb_strlen($value) <= self::MAX_TEXT_LENGTH,
            default => false,
        };

        return $valid ? null : 'Cette réponse n\'est pas valide pour cette question.';
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function questions(): array
    {
        if (null === $this->questions) {
            $this->questions = [];
            foreach ($this->toArray()['pillars'] as $pillar) {
                foreach ($pillar['themes'] ?? [] as $theme) {
                    foreach ($theme['questions'] ?? [] as $question) {
                        $this->questions[(string) $question['id']] = $question;
                    }
                }
            }
        }

        return $this->questions;
    }
}
