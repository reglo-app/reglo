<?php

namespace App\Controller;

use App\Diagnostic\DiagnosticReport;
use App\Diagnostic\Questionnaire;
use App\Diagnostic\ScoreCalculator;
use App\Diagnostic\ScoreUnavailableException;
use App\Entity\Diagnostic;
use App\Entity\DiagnosticStatus;
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
 * shared draft, saved answer by answer, then submit it. The submitted
 * diagnostics stay in a history, with their summary as a PDF, and a new
 * draft can start from the answers of one of them (US-07). Readers only
 * consult (writes refused by security.yaml); another organization's
 * diagnostic is never visible (OrganizationFilter).
 */
final class DiagnosticController
{
    public const SCORE_UNAVAILABLE = 'Le calcul du score est temporairement indisponible. Vos réponses sont conservées : réessayez dans un instant.';
    public const DRAFT_EXISTS = 'Un diagnostic est déjà en cours : reprenez-le avant d\'en commencer un autre.';

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
        $latest = $this->repository->findScored(1)[0] ?? null;

        return null === $latest ? new JsonResponse('null', json: true) : new JsonResponse($this->resultView($latest));
    }

    /**
     * The submitted diagnostics of the organization, latest first, with
     * their scores (US-07).
     */
    #[Route('/api/diagnostics', name: 'diagnostic_history', methods: ['GET'])]
    public function history(): JsonResponse
    {
        return new JsonResponse(array_map(static fn (Diagnostic $diagnostic): array => [
            'id' => (string) $diagnostic->getId(),
            'submittedAt' => $diagnostic->getSubmittedAt()?->format(\DATE_ATOM),
            'questionnaireVersion' => $diagnostic->getQuestionnaireVersion(),
            'global' => $diagnostic->getScore()['global'] ?? null,
            'maturity' => $diagnostic->getScore()['maturity'] ?? null,
            'pillars' => $diagnostic->getScore()['pillars'] ?? [],
        ], $this->repository->findScored()));
    }

    /**
     * The result of one submitted diagnostic, as on the result page, with
     * the one before it for the trend (US-07).
     */
    #[Route('/api/diagnostics/{id}/result', name: 'diagnostic_result', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function result(int $id, #[CurrentUser] User $user): JsonResponse
    {
        $diagnostic = $this->findSubmitted($id, $user);

        return null === $diagnostic ? self::notFound() : new JsonResponse($this->resultView($diagnostic));
    }

    /**
     * The summary of a submitted diagnostic as a PDF (US-07), for every
     * role. Always a download: "reglo-diagnostic-AAAA-MM-JJ.pdf".
     */
    #[Route('/api/diagnostics/{id}/pdf', name: 'diagnostic_pdf', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function pdf(int $id, #[CurrentUser] User $user, DiagnosticReport $report): Response
    {
        $diagnostic = $this->findSubmitted($id, $user);
        if (null === $diagnostic) {
            return self::notFound();
        }

        $response = new Response($report->render($diagnostic));
        $response->headers->set('Content-Type', 'application/pdf');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Content-Security-Policy', "default-src 'none'; sandbox");
        $response->headers->set('Content-Disposition', $response->headers->makeDisposition('attachment', DiagnosticReport::fileName($diagnostic)));
        $response->setPrivate();
        $response->headers->addCacheControlDirective('no-store');

        return $response;
    }

    /**
     * "Refaire un diagnostic" (US-07): a new draft with the answers of a
     * submitted diagnostic, which stays in the history. The answers that no
     * longer fit the questionnaire are left out. Refused while a draft is in
     * progress.
     */
    #[Route('/api/diagnostics/{id}/restart', name: 'diagnostic_restart', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function restart(int $id, #[CurrentUser] User $user): JsonResponse
    {
        $source = $this->findSubmitted($id, $user);
        $organization = $user->getOrganization();
        if (null === $source || null === $organization) {
            return self::notFound();
        }

        $draft = $this->entityManager->wrapInTransaction(function () use ($organization, $source, $user): ?Diagnostic {
            // Same lock as the first answer: one draft per organization.
            $this->entityManager->lock($organization, LockMode::PESSIMISTIC_WRITE);
            if (null !== $this->repository->findDraft()) {
                return null;
            }

            $draft = new Diagnostic($organization, $this->questionnaire->version(), $user);
            foreach ($source->getAnswers() as $answer) {
                if (null === $this->questionnaire->answerError($answer->getQuestionId(), $answer->getValue(), $answer->isNotApplicable())) {
                    $draft->answer($answer->getQuestionId(), $answer->getValue(), $answer->isNotApplicable(), $user);
                }
            }
            $this->entityManager->persist($draft);

            return $draft;
        });

        if (null === $draft) {
            return self::error(self::DRAFT_EXISTS, 'draft_exists', Response::HTTP_CONFLICT);
        }

        return new JsonResponse($this->view($draft), Response::HTTP_CREATED);
    }

    /**
     * Shape of DiagnosticResult in web/src/lib/api/types.ts.
     *
     * @return array<string, mixed>
     */
    private function resultView(Diagnostic $diagnostic): array
    {
        $previous = $this->repository->findScoredBefore($diagnostic);

        return [
            'diagnosticId' => (string) $diagnostic->getId(),
            'submittedAt' => $diagnostic->getSubmittedAt()?->format(\DATE_ATOM),
            'questionnaireVersion' => $diagnostic->getQuestionnaireVersion(),
            'score' => $diagnostic->getScore(),
            'previous' => null === $previous ? null : [
                'submittedAt' => $previous->getSubmittedAt()?->format(\DATE_ATOM),
                'global' => $previous->getScore()['global'] ?? null,
                'pillars' => $previous->getScore()['pillars'] ?? [],
            ],
        ];
    }

    /**
     * A submitted diagnostic with its score, of the organization of the
     * user. Already ensured by OrganizationFilter; checked again in case it
     * was loaded earlier in the request, from memory, without the filter.
     */
    private function findSubmitted(int $id, User $user): ?Diagnostic
    {
        $diagnostic = $this->repository->find($id);
        $organization = $user->getOrganization();

        if (
            null === $diagnostic
            || null === $organization
            || $diagnostic->getOrganization()?->getId() !== $organization->getId()
            || DiagnosticStatus::Submitted !== $diagnostic->getStatus()
            || null === $diagnostic->getScore()
        ) {
            return null;
        }

        return $diagnostic;
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

    private static function notFound(): JsonResponse
    {
        return self::error('Ce diagnostic n\'existe pas.', 'not_found', Response::HTTP_NOT_FOUND);
    }
}
