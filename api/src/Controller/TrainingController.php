<?php

namespace App\Controller;

use App\Entity\LessonCompletion;
use App\Entity\QhsePillar;
use App\Entity\User;
use App\Repository\LessonCompletionRepository;
use App\Training\TrainingCatalog;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Training catalog and lesson player (US-13). The courses come from the
 * catalog file; the progress is personal. Marking a lesson as done is under
 * /api/me: readers follow trainings too (security.yaml only lets them
 * write their own account). A paid course shows its description, never the
 * content of its lessons (no payment in the MVP).
 */
final class TrainingController
{
    public const PAID_COURSE = 'Cette formation sera disponible prochainement.';

    private const ID = '[a-z0-9-]{1,64}';

    public function __construct(
        private readonly TrainingCatalog $catalog,
        private readonly LessonCompletionRepository $repository,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * Optional filters: domain (QHSE key) and access ("free" or "paid").
     */
    #[Route('/api/trainings', name: 'trainings', methods: ['GET'])]
    public function list(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $query = $request->query;
        $domain = QhsePillar::tryFrom($query->getString('domain'));
        $access = $query->getString('access');
        if ((null === $domain && '' !== $query->getString('domain')) || !\in_array($access, ['', 'free', 'paid'], true)) {
            return self::error('Ce filtre n\'existe pas.', 'invalid_filter');
        }

        $done = $this->repository->lessonIdsByCourse($user);
        $courses = array_filter(
            $this->catalog->courses(),
            static fn (array $course): bool => (null === $domain || $course['domain'] === $domain->value)
                && ('' === $access || $course['free'] === ('free' === $access)),
        );

        return new JsonResponse(array_values(array_map(
            static fn (array $course): array => self::summary($course, $done[$course['id']] ?? []),
            $courses,
        )));
    }

    #[Route('/api/trainings/{id}', name: 'training', requirements: ['id' => self::ID], methods: ['GET'])]
    public function show(string $id, #[CurrentUser] User $user): JsonResponse
    {
        $course = $this->catalog->course($id);
        if (null === $course) {
            return self::notFound();
        }

        $done = $this->repository->lessonIdsByCourse($user)[$id] ?? [];
        $lessons = array_map(static function (array $lesson) use ($course, $done): array {
            $view = [
                'id' => $lesson['id'],
                'title' => $lesson['title'],
                'type' => $lesson['type'],
                'durationMinutes' => $lesson['durationMinutes'],
                'completed' => \in_array($lesson['id'], $done, true),
            ];

            return $course['free'] ? $view + [
                'paragraphs' => $lesson['paragraphs'],
                'keyPoints' => $lesson['keyPoints'],
                'videoUrl' => $lesson['videoUrl'],
                'transcript' => $lesson['transcript'],
                'pdfUrl' => $lesson['pdfUrl'],
            ] : $view;
        }, $course['lessons']);

        return new JsonResponse(self::summary($course, $done) + ['lessons' => $lessons]);
    }

    /**
     * Marks the lesson as done (again: no change). Answers the progress of
     * the course.
     */
    #[Route('/api/me/trainings/{courseId}/lessons/{lessonId}', name: 'training_lesson_done', requirements: ['courseId' => self::ID, 'lessonId' => self::ID], methods: ['PUT'])]
    public function complete(string $courseId, string $lessonId, #[CurrentUser] User $user): JsonResponse
    {
        $refusal = $this->refusal($courseId, $lessonId, $user);
        if (null !== $refusal) {
            return $refusal;
        }

        if (null === $this->repository->findOne($user, $courseId, $lessonId)) {
            $this->entityManager->persist(new LessonCompletion($user, $courseId, $lessonId));
            $this->entityManager->flush();
        }

        return $this->progress($courseId, $user);
    }

    /**
     * The lesson is no longer done.
     */
    #[Route('/api/me/trainings/{courseId}/lessons/{lessonId}', name: 'training_lesson_undone', requirements: ['courseId' => self::ID, 'lessonId' => self::ID], methods: ['DELETE'])]
    public function uncomplete(string $courseId, string $lessonId, #[CurrentUser] User $user): JsonResponse
    {
        $refusal = $this->refusal($courseId, $lessonId, $user);
        if (null !== $refusal) {
            return $refusal;
        }

        $completion = $this->repository->findOne($user, $courseId, $lessonId);
        if (null !== $completion) {
            $this->entityManager->remove($completion);
            $this->entityManager->flush();
        }

        return $this->progress($courseId, $user);
    }

    private function refusal(string $courseId, string $lessonId, User $user): ?JsonResponse
    {
        $course = $this->catalog->course($courseId);
        if (null === $course || null === $this->catalog->lesson($courseId, $lessonId)) {
            return self::notFound();
        }
        if (!$course['free']) {
            return self::error(self::PAID_COURSE, 'paid_course', Response::HTTP_FORBIDDEN);
        }
        if (null === $user->getOrganization()) {
            return self::error('Votre compte n\'appartient à aucune organisation.', 'no_organization', Response::HTTP_FORBIDDEN);
        }

        return null;
    }

    private function progress(string $courseId, User $user): JsonResponse
    {
        $course = $this->catalog->course($courseId);
        \assert(null !== $course);
        $summary = self::summary($course, $this->repository->lessonIdsByCourse($user)[$courseId] ?? []);

        return new JsonResponse(['completedCount' => $summary['completedCount'], 'lessonCount' => $summary['lessonCount']]);
    }

    /**
     * Only the lessons still in the catalog count: a lesson removed from the
     * file leaves the progress right.
     *
     * @param array<string, mixed> $course
     * @param list<string>         $done   ids of the lessons done
     *
     * @return array<string, mixed>
     */
    private static function summary(array $course, array $done): array
    {
        $lessonIds = array_column($course['lessons'], 'id');

        return [
            'id' => $course['id'],
            'title' => $course['title'],
            'summary' => $course['summary'],
            'domain' => $course['domain'],
            'level' => $course['level'],
            'free' => $course['free'],
            'durationMinutes' => array_sum(array_column($course['lessons'], 'durationMinutes')),
            'lessonCount' => \count($lessonIds),
            'completedCount' => \count(array_intersect($lessonIds, $done)),
        ];
    }

    private static function notFound(): JsonResponse
    {
        return self::error('Cette formation n\'existe pas.', 'not_found', Response::HTTP_NOT_FOUND);
    }

    private static function error(string $message, string $code, int $status = Response::HTTP_UNPROCESSABLE_ENTITY): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'code' => $code], $status);
    }
}
