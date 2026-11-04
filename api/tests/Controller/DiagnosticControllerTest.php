<?php

namespace App\Tests\Controller;

use App\Controller\DiagnosticController;
use App\Diagnostic\Questionnaire;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Tests\DataServiceMock;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Contracts\HttpClient\ResponseInterface;

/**
 * US-05. The logged-in user of ProfileTestCase is a member of Acme.
 */
final class DiagnosticControllerTest extends ProfileTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        DataServiceMock::reset();
    }

    public function testSubmittingSendsTheAnswersAndTheQuestionnaireThenStoresTheScore(): void
    {
        $this->answerEverything();

        $this->jsonAs('POST', '/api/diagnostics/current/submit');

        self::assertResponseIsSuccessful();
        self::assertCount(1, DataServiceMock::$requests);
        $request = DataServiceMock::$requests[0];
        self::assertSame('POST', $request['method']);
        self::assertStringEndsWith('/scores', $request['url']);
        $questionnaire = static::getContainer()->get(Questionnaire::class);
        self::assertSame($questionnaire->version(), $request['body']['questionnaire_version']);
        self::assertSame($questionnaire->toArray(), $request['body']['questionnaire']);
        self::assertContains(['question_id' => 'quality.pilotage.01', 'value' => 'yes', 'not_applicable' => false], $request['body']['answers']);

        $this->getAs('/api/diagnostics/latest/result');
        $result = $this->responseData();
        self::assertSame(62.5, $result['score']['global']);
        self::assertEquals(['quality' => 70, 'hygiene' => 55, 'safety' => 50, 'environment' => 75], $result['score']['pillars']);
        self::assertSame('safety.risques.01', $result['score']['gaps'][0]['question_id']);
        self::assertNull($result['previous']);
    }

    /**
     * @return iterable<string, array{\Closure(): ResponseInterface}>
     */
    public static function dataServiceFailures(): iterable
    {
        yield 'down' => [static fn (): ResponseInterface => new MockResponse('', ['error' => 'Connection refused'])];
        yield 'server error' => [static fn (): ResponseInterface => new MockResponse('{}', ['http_code' => 500])];
        yield 'refused' => [static fn (): ResponseInterface => new MockResponse('{"detail": "invalide"}', ['http_code' => 422])];
        yield 'unexpected answer' => [static fn (): ResponseInterface => new MockResponse('{"status": "ok"}', ['http_code' => 200])];
    }

    /**
     * @param \Closure(): ResponseInterface $failure
     */
    #[DataProvider('dataServiceFailures')]
    public function testWhenTheScoreCannotBeComputedTheDraftIsKept(\Closure $failure): void
    {
        $this->answerEverything();
        DataServiceMock::$handler = static fn (): ResponseInterface => $failure();

        $this->jsonAs('POST', '/api/diagnostics/current/submit');

        self::assertResponseStatusCodeSame(503);
        self::assertSame(['error' => DiagnosticController::SCORE_UNAVAILABLE, 'code' => 'score_unavailable'], $this->responseData());
        $this->getAs('/api/diagnostics/current');
        $draft = $this->responseData()['draft'];
        self::assertSame('draft', $draft['status']);
        self::assertCount(\count(static::getContainer()->get(Questionnaire::class)->mandatoryIds()), $draft['answers']);

        // Trying again once the data service is back works.
        DataServiceMock::$handler = null;
        $this->jsonAs('POST', '/api/diagnostics/current/submit');
        self::assertResponseIsSuccessful();
    }

    public function testTheResultShowsThePreviousScoreForTheTrend(): void
    {
        $this->answerEverything();
        DataServiceMock::$handler = static fn (): ResponseInterface => DataServiceMock::score(40.0, ['quality' => 40.0]);
        $this->jsonAs('POST', '/api/diagnostics/current/submit');
        $this->answerEverything();
        DataServiceMock::$handler = null;
        $this->jsonAs('POST', '/api/diagnostics/current/submit');

        $this->getAs('/api/diagnostics/latest/result');

        $result = $this->responseData();
        self::assertSame(62.5, $result['score']['global']);
        self::assertEquals(40, $result['previous']['global']);
        self::assertEquals(['quality' => 40], $result['previous']['pillars']);
    }

    public function testWithoutScoreThereIsNoResult(): void
    {
        $this->getAs('/api/diagnostics/latest/result');

        self::assertResponseIsSuccessful();
        self::assertSame('null', $this->client->getResponse()->getContent());
    }

    public function testAnotherOrganizationNeverSeesTheResultButAReaderDoes(): void
    {
        // Users first: the requests below reboot the kernel.
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $spyToken = $this->issueToken($this->createUser('spy@globex.test', $globex));
        $reader = $this->createUser('lea@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $this->entityManager->flush();
        $readerToken = $this->issueToken($reader);
        $this->answerEverything();
        $this->jsonAs('POST', '/api/diagnostics/current/submit');

        $this->getAs('/api/diagnostics/latest/result', $spyToken);
        self::assertSame('null', $this->client->getResponse()->getContent());

        $this->getAs('/api/diagnostics/latest/result', $readerToken);
        self::assertSame(62.5, $this->responseData()['score']['global']);
    }

    public function testTheQuestionnaireHasTheFourQhsePillars(): void
    {
        $this->getAs('/api/questionnaire');

        self::assertResponseIsSuccessful();
        $data = $this->responseData();
        self::assertIsString($data['version']);
        self::assertSame(['quality', 'hygiene', 'safety', 'environment'], array_column($data['pillars'], 'id'));
    }

    public function testWithoutDraftNothingIsCurrent(): void
    {
        $this->getAs('/api/diagnostics/current');

        self::assertResponseIsSuccessful();
        self::assertSame(['draft' => null, 'lastSubmittedAt' => null], $this->responseData());
    }

    public function testTheFirstAnswerStartsTheDraftAndAnswersAreSaved(): void
    {
        $this->answer('quality.pilotage.01', 'yes');
        self::assertResponseIsSuccessful();
        $this->answer('hygiene.secours.02', ['handling', 'noise']);
        self::assertResponseIsSuccessful();

        $this->getAs('/api/diagnostics/current');
        $draft = $this->responseData()['draft'];
        self::assertSame('draft', $draft['status']);
        self::assertSame(static::getContainer()->get(Questionnaire::class)->version(), $draft['questionnaireVersion']);
        self::assertSame([
            'quality.pilotage.01' => ['value' => 'yes', 'notApplicable' => false],
            'hygiene.secours.02' => ['value' => ['handling', 'noise'], 'notApplicable' => false],
        ], $draft['answers']);
    }

    public function testAnAnswerCanBeChangedOrRemoved(): void
    {
        $this->answer('quality.pilotage.02', 1);
        $this->answer('quality.pilotage.02', 3);
        self::assertSame(3, $this->responseData()['answers']['quality.pilotage.02']['value']);

        $this->answer('quality.pilotage.02', null);

        self::assertResponseIsSuccessful();
        self::assertSame([], $this->responseData()['answers']);
    }

    /**
     * @return iterable<string, array{string, mixed}>
     */
    public static function invalidAnswers(): iterable
    {
        yield 'unknown question' => ['quality.unknown.99', 'yes'];
        yield 'yes_no out of range' => ['quality.pilotage.01', 'maybe'];
        yield 'scale level too high' => ['quality.pilotage.02', 4];
        yield 'scale level as text' => ['quality.pilotage.02', '2'];
        yield 'unknown option' => ['quality.clients.02', 'sometimes'];
        yield 'multi choice twice the same' => ['hygiene.secours.02', ['noise', 'noise']];
        yield 'multi choice unknown option' => ['hygiene.secours.02', ['noise', 'robots']];
    }

    #[DataProvider('invalidAnswers')]
    public function testAnInvalidAnswerIsRefused(string $questionId, mixed $value): void
    {
        $this->answer($questionId, $value);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('invalid_answer', $this->responseData()['code']);
        self::assertSame(0, $this->countDiagnostics());
    }

    public function testNotApplicableOnlyWhereTheQuestionAllowsIt(): void
    {
        $this->jsonAs('PUT', '/api/diagnostics/current/answers', ['questionId' => 'safety.equipements.01', 'notApplicable' => true]);
        self::assertResponseIsSuccessful();
        self::assertSame(['value' => null, 'notApplicable' => true], $this->responseData()['answers']['safety.equipements.01']);

        $this->jsonAs('PUT', '/api/diagnostics/current/answers', ['questionId' => 'safety.risques.01', 'notApplicable' => true]);
        self::assertResponseStatusCodeSame(422);
    }

    public function testTheMembersOfTheOrganizationShareOneDraft(): void
    {
        $colleague = $this->createUser('paul@acme.test', $this->organization);
        $this->answer('quality.pilotage.01', 'yes');

        $this->jsonAs('PUT', '/api/diagnostics/current/answers', ['questionId' => 'quality.pilotage.02', 'value' => 2], $this->issueToken($colleague));

        self::assertResponseIsSuccessful();
        self::assertCount(2, $this->responseData()['answers']);
        self::assertSame(1, $this->countDiagnostics());
    }

    public function testAnotherOrganizationNeverSeesTheDraft(): void
    {
        $this->answer('quality.pilotage.01', 'yes');
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $spyToken = $this->issueToken($this->createUser('spy@globex.test', $globex));

        $this->getAs('/api/diagnostics/current', $spyToken);
        self::assertSame(['draft' => null, 'lastSubmittedAt' => null], $this->responseData());

        // Its own answer starts its own draft: Acme's one is untouched.
        $this->jsonAs('PUT', '/api/diagnostics/current/answers', ['questionId' => 'quality.pilotage.01', 'value' => 'no'], $spyToken);
        self::assertSame(['quality.pilotage.01'], array_keys($this->responseData()['answers']));
        $this->getAs('/api/diagnostics/current');
        self::assertSame('yes', $this->responseData()['draft']['answers']['quality.pilotage.01']['value']);
        self::assertSame(2, $this->countDiagnostics());
    }

    public function testAReaderConsultsButCannotAnswerNorSubmit(): void
    {
        $this->answer('quality.pilotage.01', 'yes');
        $reader = $this->createUser('lea@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $this->entityManager->flush();
        $readerToken = $this->issueToken($reader);

        $this->getAs('/api/diagnostics/current', $readerToken);
        self::assertResponseIsSuccessful();
        self::assertNotNull($this->responseData()['draft']);

        $this->jsonAs('PUT', '/api/diagnostics/current/answers', ['questionId' => 'quality.pilotage.02', 'value' => 2], $readerToken);
        self::assertResponseStatusCodeSame(403);
        $this->jsonAs('POST', '/api/diagnostics/current/submit', token: $readerToken);
        self::assertResponseStatusCodeSame(403);
    }

    public function testSubmittingNeedsEveryMandatoryAnswer(): void
    {
        $this->answer('quality.pilotage.01', 'yes');

        $this->jsonAs('POST', '/api/diagnostics/current/submit');

        self::assertResponseStatusCodeSame(422);
        $data = $this->responseData();
        self::assertSame('incomplete', $data['code']);
        self::assertCount(\count(static::getContainer()->get(Questionnaire::class)->mandatoryIds()) - 1, $data['missing']);
        self::assertNotContains('quality.pilotage.01', $data['missing']);
    }

    public function testAFullDiagnosticIsSubmittedThenANewDraftCanStart(): void
    {
        $this->answerEverything();

        $this->jsonAs('POST', '/api/diagnostics/current/submit');

        self::assertResponseIsSuccessful();
        self::assertSame('submitted', $this->responseData()['status']);
        $this->getAs('/api/diagnostics/current');
        $current = $this->responseData();
        self::assertNull($current['draft']);
        self::assertIsString($current['lastSubmittedAt']);

        $this->answer('quality.pilotage.01', 'no');
        self::assertSame(['quality.pilotage.01'], array_keys($this->responseData()['answers']));
        self::assertSame(2, $this->countDiagnostics());
    }

    public function testSubmittingWithoutDraftIsRefused(): void
    {
        $this->jsonAs('POST', '/api/diagnostics/current/submit');

        self::assertResponseStatusCodeSame(409);
        self::assertSame('no_draft', $this->responseData()['code']);
    }

    private function answer(string $questionId, mixed $value): void
    {
        $this->jsonAs('PUT', '/api/diagnostics/current/answers', ['questionId' => $questionId, 'value' => $value]);
    }

    /**
     * A valid answer to every question of the questionnaire.
     */
    private function answerEverything(): void
    {
        foreach (static::getContainer()->get(Questionnaire::class)->toArray()['pillars'] as $pillar) {
            foreach ($pillar['themes'] as $theme) {
                foreach ($theme['questions'] as $question) {
                    $this->answer($question['id'], match ($question['type']) {
                        'yes_no' => 'yes',
                        'scale' => 0,
                        'single_choice' => $question['options'][0]['id'],
                        'multi_choice' => [],
                        default => 'Texte',
                    });
                    self::assertResponseIsSuccessful();
                }
            }
        }
    }

    private function countDiagnostics(): int
    {
        return (int) $this->entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM diagnostic');
    }
}
