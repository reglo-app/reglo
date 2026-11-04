<?php

namespace App\Controller;

use App\Diagnostic\Questionnaire;
use App\Diagnostic\ScoreCalculator;
use App\Diagnostic\ScoreUnavailableException;
use App\Entity\Diagnostic;
use App\Entity\User;
use App\Repository\DiagnosticRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Exception\JsonException;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * QHSE diagnostic (US-05): the members of an organization fill in one
 * shared draft, saved answer by answer, then submit it. Readers only
 * consult (writes refused by security.yaml); another organization's
 * diagnostic is never visible (OrganizationFilter).
 */
final class DiagnosticController
{
    public const SCORE_UNAVAILABLE = 'Le calcul du score est temporairement indisponible. Vos réponses sont conservées : réessayez dans un instant.';

    public function __construct(
        private readonly Questionnaire $questionnaire,
        private readonly DiagnosticRepository $repository,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('/api/questionnaire', name: 'questionnaire', methods: ['GET'])]
    public function questionnaire(): JsonResponse
    {
        return new JsonResponse($this->questionnaire->toArray());
    }

    /**
     * The draft of the organization (null if none), and when the last
     * diagnostic was submitted.
     */
    #[Route('/api/diagnostics/current', name: 'diagnostic_current', methods: ['GET'])]
    public function current(): JsonResponse
    {
        $draft = $this->repository->findDraft();

        return new JsonResponse([
            'draft' => null === $draft ? null : $this->view($draft),
            'lastSubmittedAt' => $this->repository->findLastSubmitted()?->getSubmittedAt()?->format(\DATE_ATOM),
        ]);
    }

    /**
     * Saves one answer, starting the draft at the first one. Body:
     * {"questionId": "quality.pilotage.01", "value": …, "notApplicable":
     * false}; a null value removes the answer. The question id is not in
     * the URL: its dots would look like a file extension to web servers.
     */
    #[Route('/api/diagnostics/current/answers', name: 'diagnostic_answer', methods: ['PUT'])]
    public function answer(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $organization = $user->getOrganization();
        if (null === $organization) {
            return self::error('Votre compte n\'appartient à aucune organisation.', 'no_organization', Response::HTTP_FORBIDDEN);
        }

        try {
            $body = $request->toArray();
        } catch (JsonException) {
            $body = [];
        }
        $questionId = \is_string($body['questionId'] ?? null) ? $body['questionId'] : '';
        $value = $body['value'] ?? null;
        $notApplicable = true === ($body['notApplicable'] ?? false);

        if (null !== $value || $notApplicable) {
            $error = $this->questionnaire->answerError($questionId, $value, $notApplicable);
            if (null !== $error) {
                return self::error($error, 'invalid_answer');
            }
        } elseif (null === $this->questionnaire->question($questionId)) {
            return self::error('Cette question n\'existe pas.', 'invalid_answer');
        }

        $draft = $this->repository->findDraft() ?? $this->entityManager->wrapInTransaction(function () use ($organization, $user): Diagnostic {
            // Two members answering the very first question at the same
            // time must share one draft: the second one waits, then finds it.
            $this->entityManager->lock($organization, LockMode::PESSIMISTIC_WRITE);

            $draft = $this->repository->findDraft();
            if (null === $draft) {
                $draft = new Diagnostic($organization, $this->questionnaire->version(), $user);
                $this->entityManager->persist($draft);
            }

            return $draft;
        });

        $draft->answer($questionId, $value, $notApplicable, $user);
        $this->entityManager->flush();

        return new JsonResponse($this->view($draft));
    }

    /**
     * Refused while a mandatory question is unanswered: the answer lists
     * them, so the web app can lead the user there. The score is computed
     * by the data service first: if it fails, the draft is kept as is.
     */
    #[Route('/api/diagnostics/current/submit', name: 'diagnostic_submit', methods: ['POST'])]
    public function submit(ScoreCalculator $scoreCalculator): JsonResponse
    {
        $draft = $this->repository->findDraft();
        if (null === $draft) {
            return self::error('Aucun diagnostic n\'est en cours.', 'no_draft', Response::HTTP_CONFLICT);
        }

        $missing = $draft->missingAnswers($this->questionnaire->mandatoryIds());
        if ([] !== $missing) {
            return new JsonResponse([
                'error' => \sprintf('Répondez aux %d questions obligatoires restantes avant de valider.', \count($missing)),
                'code' => 'incomplete',
                'missing' => $missing,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        try {
            $score = $scoreCalculator->compute($draft);
        } catch (ScoreUnavailableException) {
            return self::error(self::SCORE_UNAVAILABLE, 'score_unavailable', Response::HTTP_SERVICE_UNAVAILABLE);
        }

        $draft->submit($score);
        $this->entityManager->flush();

        return new JsonResponse($this->view($draft));
    }

    /**
     * Score of the latest submitted diagnostic of the organization, with
     * the previous one (null if none) to show the trend; null if never
     * scored.
     */
    #[Route('/api/diagnostics/latest/result', name: 'diagnostic_latest_result', methods: ['GET'])]
    public function latestResult(): JsonResponse
    {
        $scored = $this->repository->findScored(2);
        if ([] === $scored) {
            return new JsonResponse('null', json: true);
        }

        $latest = $scored[0];
        $previous = $scored[1] ?? null;

        return new JsonResponse([
            'diagnosticId' => (string) $latest->getId(),
            'submittedAt' => $latest->getSubmittedAt()?->format(\DATE_ATOM),
            'questionnaireVersion' => $latest->getQuestionnaireVersion(),
            'score' => $latest->getScore(),
            'previous' => null === $previous ? null : [
                'submittedAt' => $previous->getSubmittedAt()?->format(\DATE_ATOM),
                'global' => $previous->getScore()['global'] ?? null,
                'pillars' => $previous->getScore()['pillars'] ?? [],
            ],
        ]);
    }

    /**
     * Shape of Diagnostic in web/src/lib/api/types.ts.
     *
     * @return array<string, mixed>
     */
    private function view(Diagnostic $diagnostic): array
    {
        $answers = [];
        foreach ($diagnostic->getAnswers() as $answer) {
            $answers[$answer->getQuestionId()] = [
                'value' => $answer->getValue(),
                'notApplicable' => $answer->isNotApplicable(),
            ];
        }

        return [
            'id' => (string) $diagnostic->getId(),
            'status' => $diagnostic->getStatus()->value,
            'questionnaireVersion' => $diagnostic->getQuestionnaireVersion(),
            'startedAt' => $diagnostic->getStartedAt()->format(\DATE_ATOM),
            'updatedAt' => $diagnostic->getUpdatedAt()->format(\DATE_ATOM),
            'submittedAt' => $diagnostic->getSubmittedAt()?->format(\DATE_ATOM),
            // An object even when empty, keyed by question id
            'answers' => (object) $answers,
        ];
    }

    private static function error(string $message, string $code, int $status = Response::HTTP_UNPROCESSABLE_ENTITY): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'code' => $code], $status);
    }
}
