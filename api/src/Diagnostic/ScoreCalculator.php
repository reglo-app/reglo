<?php

namespace App\Diagnostic;

use App\Entity\Diagnostic;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Asks the data service for the score of a diagnostic (US-06): POST
 * /scores with the answers and the questionnaire itself, so the data service
 * never needs its own copy. Timeout and retry: framework.yaml.
 */
final class ScoreCalculator
{
    public function __construct(
        private readonly HttpClientInterface $dataServiceClient,
        private readonly Questionnaire $questionnaire,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * @return array<string, mixed> global, maturity, pillars, themes,
     *                              coverage, gaps, algoVersion
     *
     * @throws ScoreUnavailableException when the data service fails
     */
    public function compute(Diagnostic $diagnostic): array
    {
        $answers = [];
        foreach ($diagnostic->getAnswers() as $answer) {
            $answers[] = [
                'question_id' => $answer->getQuestionId(),
                'value' => $answer->getValue(),
                'not_applicable' => $answer->isNotApplicable(),
            ];
        }

        try {
            $data = $this->dataServiceClient->request('POST', '/scores', ['json' => [
                'questionnaire_version' => $diagnostic->getQuestionnaireVersion(),
                'questionnaire' => $this->questionnaire->toArray(),
                'answers' => $answers,
            ]])->toArray();
        } catch (ExceptionInterface $exception) {
            $this->logger->error('The data service could not compute the score.', ['exception' => $exception]);

            throw new ScoreUnavailableException(previous: $exception);
        }

        if (!\array_key_exists('global', $data) || !\is_array($data['pillars'] ?? null)) {
            $this->logger->error('The data service answered an unexpected score.', ['response' => $data]);

            throw new ScoreUnavailableException();
        }

        return [
            'global' => $data['global'],
            'maturity' => $data['maturity'] ?? null,
            'pillars' => $data['pillars'],
            'themes' => $data['themes'] ?? [],
            'coverage' => $data['coverage'] ?? null,
            'gaps' => $data['gaps'] ?? [],
            'algoVersion' => $data['algo_version'] ?? null,
        ];
    }
}
