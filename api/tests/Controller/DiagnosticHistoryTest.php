<?php

namespace App\Tests\Controller;

use App\Controller\DiagnosticController;
use App\Diagnostic\Questionnaire;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Tests\DataServiceMock;
use Symfony\Contracts\HttpClient\ResponseInterface;

/**
 * US-07: the history of the submitted diagnostics, the summary as a PDF and
 * "Refaire un diagnostic". The logged-in user of ProfileTestCase is a
 * member of Acme.
 */
final class DiagnosticHistoryTest extends ProfileTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        DataServiceMock::reset();
    }

    public function testTheHistoryListsTheSubmittedDiagnosticsLatestFirst(): void
    {
        $first = $this->submitted(40.0);
        $second = $this->submitted(62.5);
        // A draft in progress is not in the history.
        $this->answer('quality.pilotage.01', 'no');

        $this->getAs('/api/diagnostics');

        self::assertResponseIsSuccessful();
        $history = $this->responseList();
        self::assertSame([$second, $first], array_column($history, 'id'));
        self::assertEquals(62.5, $history[0]['global']);
        self::assertSame('Maîtrisé', $history[0]['maturity']);
        self::assertEquals(['quality' => 40], $history[1]['pillars']);
    }

    public function testAnOldResultShowsTheOneBeforeItForTheTrend(): void
    {
        $first = $this->submitted(40.0);
        $second = $this->submitted(62.5);
        $this->submitted(80.0);

        $this->getAs('/api/diagnostics/'.$second.'/result');
        self::assertResponseIsSuccessful();
        $result = $this->responseData();
        self::assertSame($second, $result['diagnosticId']);
        self::assertSame(62.5, $result['score']['global']);
        self::assertEquals(40, $result['previous']['global']);

        $this->getAs('/api/diagnostics/'.$first.'/result');
        self::assertNull($this->responseData()['previous']);
    }

    public function testADraftOrAnUnknownDiagnosticHasNoResultNorPdf(): void
    {
        $this->answer('quality.pilotage.01', 'no');
        $draft = (string) $this->responseData()['id'];

        foreach (['/api/diagnostics/'.$draft.'/result', '/api/diagnostics/'.$draft.'/pdf', '/api/diagnostics/999999/result', '/api/diagnostics/999999/pdf'] as $uri) {
            $this->getAs($uri);
            self::assertResponseStatusCodeSame(404, $uri);
        }
    }

    public function testTheSummaryIsAPdfDownloadNamedAfterItsDate(): void
    {
        $id = $this->submitted(62.5);
        $date = (new \DateTimeImmutable('now', new \DateTimeZone('Europe/Paris')))->format('Y-m-d');

        $start = microtime(true);
        $this->getAs('/api/diagnostics/'.$id.'/pdf');
        $seconds = microtime(true) - $start;

        self::assertResponseIsSuccessful();
        $content = (string) $this->client->getResponse()->getContent();
        self::assertStringStartsWith('%PDF-', $content);
        self::assertGreaterThan(2000, \strlen($content));
        self::assertLessThan(10, $seconds);
        self::assertResponseHeaderSame('Content-Type', 'application/pdf');
        self::assertResponseHeaderSame('X-Content-Type-Options', 'nosniff');
        self::assertResponseHeaderSame('Content-Disposition', 'attachment; filename=reglo-diagnostic-'.$date.'.pdf');
        self::assertStringContainsString('no-store', (string) $this->client->getResponse()->headers->get('Cache-Control'));
    }

    public function testAReaderDownloadsTheSummaryButCannotRestart(): void
    {
        // Accounts first: requests reboot the kernel, so the entity manager.
        $reader = $this->createUser('lea@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $this->entityManager->flush();
        $readerToken = $this->issueToken($reader);
        $id = $this->submitted(62.5);

        $this->getAs('/api/diagnostics', $readerToken);
        self::assertCount(1, $this->responseList());
        $this->getAs('/api/diagnostics/'.$id.'/pdf', $readerToken);
        self::assertResponseIsSuccessful();

        $this->jsonAs('POST', '/api/diagnostics/'.$id.'/restart', token: $readerToken);
        self::assertResponseStatusCodeSame(403);
        self::assertSame(1, $this->countDiagnostics());
    }

    public function testAnotherOrganizationNeverSeesTheHistoryNorThePdf(): void
    {
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $spyToken = $this->issueToken($this->createUser('spy@globex.test', $globex));
        $id = $this->submitted(62.5);

        $this->getAs('/api/diagnostics', $spyToken);
        self::assertSame([], $this->responseList());
        foreach (['/result', '/pdf'] as $suffix) {
            $this->getAs('/api/diagnostics/'.$id.$suffix, $spyToken);
            self::assertResponseStatusCodeSame(404);
        }
        $this->jsonAs('POST', '/api/diagnostics/'.$id.'/restart', token: $spyToken);
        self::assertResponseStatusCodeSame(404);
        self::assertSame(1, $this->countDiagnostics());
    }

    public function testAnonymousRequestsAreRefused(): void
    {
        $id = $this->submitted(62.5);

        foreach (['/api/diagnostics', '/api/diagnostics/'.$id.'/result', '/api/diagnostics/'.$id.'/pdf'] as $uri) {
            $this->client->request('GET', $uri);
            self::assertResponseStatusCodeSame(401);
        }
    }

    public function testRestartingCopiesTheAnswersAndKeepsTheOldDiagnostic(): void
    {
        $id = $this->submitted(62.5);
        $before = $this->answersOf((int) $id);
        // An answer to a question removed from the questionnaire since.
        $this->entityManager->getConnection()->insert('diagnostic_answer', [
            'diagnostic_id' => $id,
            'question_id' => 'quality.removed.99',
            'value' => '"yes"',
            'not_applicable' => 'false',
            'answered_by_id' => $this->user->getId(),
            'answered_at' => '2026-11-01 10:00:00',
        ]);

        $this->jsonAs('POST', '/api/diagnostics/'.$id.'/restart');

        self::assertResponseStatusCodeSame(201);
        $draft = $this->responseData();
        self::assertSame('draft', $draft['status']);
        self::assertNotSame($id, $draft['id']);
        self::assertEquals($before, $this->answersOf((int) $draft['id']));
        self::assertArrayNotHasKey('quality.removed.99', $draft['answers']);

        $this->getAs('/api/diagnostics/current');
        self::assertSame($draft['id'], $this->responseData()['draft']['id']);
        $this->getAs('/api/diagnostics');
        self::assertSame([$id], array_column($this->responseList(), 'id'));
        // The old diagnostic keeps all its answers.
        self::assertCount(\count($before) + 1, $this->answersOf((int) $id));
    }

    public function testThereIsOnlyOneDraftAtATime(): void
    {
        $id = $this->submitted(62.5);
        $this->jsonAs('POST', '/api/diagnostics/'.$id.'/restart');
        self::assertResponseStatusCodeSame(201);

        $this->jsonAs('POST', '/api/diagnostics/'.$id.'/restart');

        self::assertResponseStatusCodeSame(409);
        self::assertSame(DiagnosticController::DRAFT_EXISTS, $this->responseData()['error']);
        self::assertSame(2, $this->countDiagnostics());
    }

    /**
     * Answers every question, then submits: the id of the diagnostic.
     */
    private function submitted(float $global): string
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

        DataServiceMock::$handler = static fn (): ResponseInterface => DataServiceMock::score($global, ['quality' => $global]);
        $this->jsonAs('POST', '/api/diagnostics/current/submit');
        self::assertResponseIsSuccessful();
        // Distinct submission times: the order does not depend on the id.
        usleep(10_000);

        return (string) $this->responseData()['id'];
    }

    private function answer(string $questionId, mixed $value): void
    {
        $this->jsonAs('PUT', '/api/diagnostics/current/answers', ['questionId' => $questionId, 'value' => $value]);
    }

    /**
     * @return array<string, array{value: mixed, not_applicable: bool}>
     */
    private function answersOf(int $diagnosticId): array
    {
        $rows = $this->entityManager->getConnection()->fetchAllAssociative(
            'SELECT question_id, value, not_applicable FROM diagnostic_answer WHERE diagnostic_id = ? ORDER BY question_id',
            [$diagnosticId],
        );

        $answers = [];
        foreach ($rows as $row) {
            $answers[(string) $row['question_id']] = ['value' => json_decode((string) $row['value'], true), 'not_applicable' => (bool) $row['not_applicable']];
        }

        return $answers;
    }

    private function countDiagnostics(): int
    {
        return (int) $this->entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM diagnostic');
    }
}
