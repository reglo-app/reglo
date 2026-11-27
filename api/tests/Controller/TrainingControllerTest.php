<?php

namespace App\Tests\Controller;

use App\Controller\TrainingController;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Entity\User;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * US-13, on the courses of tests/Fixtures/trainings.json. The logged-in
 * user of ProfileTestCase is a member of Acme.
 */
final class TrainingControllerTest extends ProfileTestCase
{
    private const LESSON = '/api/me/trainings/quality-basics/lessons/intro';

    public function testTheCatalogListsEveryCourseWithItsProgress(): void
    {
        $this->jsonAs('PUT', self::LESSON);

        $this->getAs('/api/trainings');

        self::assertResponseIsSuccessful();
        $courses = $this->responseList();
        self::assertSame(['quality-basics', 'safety-basics', 'hygiene-advanced'], array_column($courses, 'id'));
        self::assertSame([
            'id' => 'quality-basics',
            'title' => 'Quality basics',
            'summary' => 'Free course with every lesson type.',
            'domain' => 'quality',
            'level' => 'beginner',
            'free' => true,
            'durationMinutes' => 15,
            'lessonCount' => 3,
            'completedCount' => 1,
        ], $courses[0]);
        self::assertSame(0, $courses[1]['completedCount']);
    }

    /**
     * @return iterable<string, array{string, list<string>}>
     */
    public static function filters(): iterable
    {
        yield 'domain' => ['?domain=safety', ['safety-basics']];
        yield 'free' => ['?access=free', ['quality-basics', 'safety-basics']];
        yield 'paid' => ['?access=paid', ['hygiene-advanced']];
        yield 'both' => ['?domain=quality&access=paid', []];
        yield 'none' => ['?domain=&access=', ['quality-basics', 'safety-basics', 'hygiene-advanced']];
    }

    /**
     * @param list<string> $ids
     */
    #[DataProvider('filters')]
    public function testTheCatalogIsFiltered(string $query, array $ids): void
    {
        $this->getAs('/api/trainings'.$query);

        self::assertResponseIsSuccessful();
        self::assertSame($ids, array_column($this->responseList(), 'id'));
    }

    #[DataProvider('unknownFilters')]
    public function testAnUnknownFilterIsRefused(string $query): void
    {
        $this->getAs('/api/trainings'.$query);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('invalid_filter', $this->responseData()['code']);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function unknownFilters(): iterable
    {
        yield 'domain' => ['?domain=rse'];
        yield 'access' => ['?access=premium'];
    }

    public function testAFreeCourseGivesTheContentOfItsLessons(): void
    {
        $this->getAs('/api/trainings/quality-basics');

        self::assertResponseIsSuccessful();
        $course = $this->responseData();
        self::assertSame('Quality basics', $course['title']);
        self::assertSame(['intro', 'video', 'guide'], array_column($course['lessons'], 'id'));
        self::assertSame([
            'id' => 'intro',
            'title' => 'Introduction',
            'type' => 'text',
            'durationMinutes' => 5,
            'completed' => false,
            'paragraphs' => ['First paragraph.', 'Second paragraph.'],
            'keyPoints' => ['Key point.'],
            'videoUrl' => null,
            'transcript' => [],
            'pdfUrl' => null,
        ], $course['lessons'][0]);
        self::assertSame('https://www.youtube-nocookie.com/embed/test', $course['lessons'][1]['videoUrl']);
        self::assertSame(['Transcript paragraph.'], $course['lessons'][1]['transcript']);
        self::assertSame('https://example.com/guide.pdf', $course['lessons'][2]['pdfUrl']);
    }

    public function testAPaidCourseOnlyGivesItsDescription(): void
    {
        $this->getAs('/api/trainings/hygiene-advanced');

        self::assertResponseIsSuccessful();
        $course = $this->responseData();
        self::assertFalse($course['free']);
        self::assertSame('Paid course.', $course['summary']);
        self::assertSame([['id' => 'secret', 'title' => 'Paid lesson', 'type' => 'text', 'durationMinutes' => 20, 'completed' => false]], $course['lessons']);
        self::assertStringNotContainsString('Paid content.', (string) $this->client->getResponse()->getContent());
    }

    public function testAnUnknownCourseIsNotFound(): void
    {
        $this->getAs('/api/trainings/unknown');

        self::assertResponseStatusCodeSame(404);
        self::assertSame(['error' => 'Cette formation n\'existe pas.', 'code' => 'not_found'], $this->responseData());
    }

    public function testALessonIsMarkedDoneOnceThenUndone(): void
    {
        $this->jsonAs('PUT', self::LESSON);
        self::assertResponseIsSuccessful();
        self::assertSame(['completedCount' => 1, 'lessonCount' => 3], $this->responseData());

        // Again: nothing changes.
        $this->jsonAs('PUT', self::LESSON);
        self::assertSame(['completedCount' => 1, 'lessonCount' => 3], $this->responseData());
        self::assertSame(1, $this->countCompletions());

        $this->getAs('/api/trainings/quality-basics');
        self::assertSame([true, false, false], array_column($this->responseData()['lessons'], 'completed'));

        $this->jsonAs('DELETE', self::LESSON);
        self::assertResponseIsSuccessful();
        self::assertSame(['completedCount' => 0, 'lessonCount' => 3], $this->responseData());
        self::assertSame(0, $this->countCompletions());
    }

    /**
     * @return iterable<string, array{string, int, string}>
     */
    public static function refusedLessons(): iterable
    {
        yield 'unknown course' => ['/api/me/trainings/unknown/lessons/intro', 404, 'not_found'];
        yield 'unknown lesson' => ['/api/me/trainings/quality-basics/lessons/unknown', 404, 'not_found'];
        yield 'lesson of another course' => ['/api/me/trainings/safety-basics/lessons/intro', 404, 'not_found'];
        yield 'paid course' => ['/api/me/trainings/hygiene-advanced/lessons/secret', 403, 'paid_course'];
    }

    #[DataProvider('refusedLessons')]
    public function testALessonThatCannotBeFollowedIsRefused(string $uri, int $status, string $code): void
    {
        foreach (['PUT', 'DELETE'] as $method) {
            $this->jsonAs($method, $uri);

            self::assertResponseStatusCodeSame($status);
            self::assertSame($code, $this->responseData()['code']);
            if ('paid_course' === $code) {
                self::assertSame(TrainingController::PAID_COURSE, $this->responseData()['error']);
            }
        }
        self::assertSame(0, $this->countCompletions());
    }

    public function testAReaderFollowsTrainingsToo(): void
    {
        $reader = $this->createUser('lea@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $this->entityManager->flush();

        $this->jsonAs('PUT', self::LESSON, token: $this->issueToken($reader));

        self::assertResponseIsSuccessful();
        self::assertSame(1, $this->responseData()['completedCount']);
    }

    public function testTheProgressIsPersonalAndNeverSeenByAnotherOrganization(): void
    {
        // Users first: the requests below reboot the kernel.
        $colleagueToken = $this->issueToken($this->createUser('paul@acme.test', $this->organization));
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $spyToken = $this->issueToken($this->createUser('spy@globex.test', $globex));
        $this->jsonAs('PUT', self::LESSON);

        foreach ([$colleagueToken, $spyToken] as $token) {
            $this->getAs('/api/trainings/quality-basics', $token);
            self::assertSame(0, $this->responseData()['completedCount']);
            self::assertSame([false, false, false], array_column($this->responseData()['lessons'], 'completed'));
        }

        // Their own progress does not touch Claire's.
        $this->jsonAs('DELETE', self::LESSON, token: $spyToken);
        $this->getAs('/api/trainings/quality-basics');
        self::assertSame(1, $this->responseData()['completedCount']);
    }

    public function testAPlatformAdministratorBrowsesButHasNoProgress(): void
    {
        $admin = $this->createUser('team@reglo.site', null)->setRoles([User::ROLE_PLATFORM_ADMIN]);
        $this->entityManager->flush();
        $token = $this->issueToken($admin);

        $this->getAs('/api/trainings', $token);
        self::assertResponseIsSuccessful();

        $this->jsonAs('PUT', self::LESSON, token: $token);
        self::assertResponseStatusCodeSame(403);
        self::assertSame('no_organization', $this->responseData()['code']);
    }

    public function testTheTrainingsNeedToBeLoggedIn(): void
    {
        $this->client->request('GET', '/api/trainings');
        self::assertResponseStatusCodeSame(401);

        $this->client->jsonRequest('PUT', self::LESSON);
        self::assertResponseStatusCodeSame(401);
    }

    public function testTheProgressIsInThePersonalDataExportAndLeavesWithTheAccount(): void
    {
        $this->jsonAs('PUT', self::LESSON);

        $this->getAs('/api/me/export');
        $lessons = $this->responseData()['lessonsCompleted'];
        self::assertCount(1, $lessons);
        self::assertSame(['Quality basics', 'Introduction'], [$lessons[0]['training'], $lessons[0]['lesson']]);

        // Deleting the account (US-04) deletes its progress.
        $this->entityManager->getConnection()->executeStatement('DELETE FROM app_user WHERE id = ?', [$this->user->getId()]);
        self::assertSame(0, $this->countCompletions());
    }

    private function countCompletions(): int
    {
        return (int) $this->entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM lesson_completion');
    }
}
