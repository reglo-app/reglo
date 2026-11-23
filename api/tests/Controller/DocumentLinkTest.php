<?php

namespace App\Tests\Controller;

use App\Controller\DocumentController;
use App\Diagnostic\Questionnaire;
use App\Entity\Action;
use App\Entity\ActionType;
use App\Entity\Document;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Entity\QhsePillar;
use App\Entity\User;
use App\Storage\DocumentStorage;
use App\Tests\DataServiceMock;

/**
 * US-12: finding the documents, linking them to actions and to questions of
 * the diagnostic, and the access log. The logged-in user of
 * ProfileTestCase is a member of Acme.
 */
final class DocumentLinkTest extends ProfileTestCase
{
    private const PDF = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n";
    private const QUESTION = 'safety.risques.01';

    /** @var list<string> */
    private array $storedFiles = [];

    protected function setUp(): void
    {
        parent::setUp();
        DataServiceMock::reset();
    }

    protected function tearDown(): void
    {
        $storage = static::getContainer()->get(DocumentStorage::class);
        foreach ($this->storedFiles as $name) {
            $storage->delete($name);
        }
        parent::tearDown();
    }

    public function testTheListIsFilteredBySearchFormatDomainAndAuthor(): void
    {
        $paul = $this->createUser('paul@acme.test', $this->organization);
        $this->createDocument('DUERP 2026.pdf', 'application/pdf', QhsePillar::Safety);
        $this->createDocument('Registre des déchets.csv', 'text/csv', QhsePillar::Environment);
        $this->createDocument('Photo extincteur.jpg', 'image/jpeg', QhsePillar::Safety, $paul);

        $this->assertListed('?q=duerp', ['DUERP 2026.pdf']);
        $this->assertListed('?q=%25', []);
        $this->assertListed('?format=spreadsheet', ['Registre des déchets.csv']);
        $this->assertListed('?format=image', ['Photo extincteur.jpg']);
        $this->assertListed('?domain=safety&author='.$paul->getId(), ['Photo extincteur.jpg']);
        $this->assertListed('?sort=name', ['DUERP 2026.pdf', 'Photo extincteur.jpg', 'Registre des déchets.csv']);
        $this->assertListed('?sort=oldest', ['DUERP 2026.pdf', 'Registre des déchets.csv', 'Photo extincteur.jpg']);
    }

    public function testThePeriodKeepsOnlyRecentDocuments(): void
    {
        $old = $this->createDocument('Ancien rapport.pdf');
        $this->createDocument('Rapport récent.pdf');
        $this->entityManager->getConnection()->executeStatement(
            'UPDATE document SET created_at = ? WHERE id = ?',
            [(new \DateTimeImmutable('-45 days'))->format('Y-m-d H:i:s'), $old->getId()],
        );

        $this->assertListed('?period=30d', ['Rapport récent.pdf']);
        $this->assertListed('?period=12m', ['Rapport récent.pdf', 'Ancien rapport.pdf']);
    }

    public function testAFilterThatDoesNotExistIsRefused(): void
    {
        foreach (['?format=zip', '?domain=finance', '?author=paul', '?period=week', '?sort=size', '?q='.str_repeat('a', 101)] as $query) {
            $this->getAs('/api/documents'.$query);

            self::assertResponseStatusCodeSame(422, $query);
            self::assertSame('invalid_filter', $this->responseData()['code']);
        }
    }

    public function testADocumentIsLinkedToSeveralActionsAndShownWithThem(): void
    {
        $document = $this->createDocument('Rapport de vérification.pdf');
        $first = $this->createAction('Vérifier les extincteurs');
        $second = $this->createAction('Former au maniement');

        $this->jsonAs('POST', '/api/actions/'.$first->getId().'/documents', ['documentId' => (string) $document->getId()]);
        self::assertResponseStatusCodeSame(201);
        $this->jsonAs('POST', '/api/actions/'.$first->getId().'/documents', ['documentId' => (string) $document->getId()]);
        self::assertResponseStatusCodeSame(200);
        $this->jsonAs('POST', '/api/actions/'.$second->getId().'/documents', ['documentId' => (string) $document->getId()]);
        self::assertResponseStatusCodeSame(201);

        $this->getAs('/api/actions/'.$first->getId());
        self::assertSame(['Rapport de vérification.pdf'], array_column($this->responseData()['documents'], 'name'));

        $this->getAs('/api/documents');
        $titles = array_column($this->responseList()[0]['actions'], 'title');
        sort($titles);
        self::assertSame(['Former au maniement', 'Vérifier les extincteurs'], $titles);
        self::assertSame(2, $this->countRows('action_document'));
    }

    public function testUnlinkingKeepsTheDocumentAndTheAction(): void
    {
        $document = $this->createDocument('Rapport.pdf');
        $action = $this->createAction();
        $this->jsonAs('POST', '/api/actions/'.$action->getId().'/documents', ['documentId' => (string) $document->getId()]);

        $this->jsonAs('DELETE', '/api/actions/'.$action->getId().'/documents/'.$document->getId());
        self::assertResponseStatusCodeSame(204);
        $this->jsonAs('DELETE', '/api/actions/'.$action->getId().'/documents/'.$document->getId());
        self::assertResponseStatusCodeSame(204);

        self::assertSame(0, $this->countRows('action_document'));
        self::assertSame(1, $this->countRows('document'));
        self::assertSame(1, $this->countRows('qhse_action'));
    }

    public function testDeletingADocumentRemovesItsLinksButNotTheAction(): void
    {
        $document = $this->createDocument('Rapport.pdf');
        $action = $this->createAction();
        $this->jsonAs('POST', '/api/actions/'.$action->getId().'/documents', ['documentId' => (string) $document->getId()]);
        $this->jsonAs('PUT', '/api/question-documents', ['questionId' => self::QUESTION, 'documentId' => (string) $document->getId()]);

        $this->jsonAs('DELETE', '/api/documents/'.$document->getId());

        self::assertResponseStatusCodeSame(204);
        self::assertSame(0, $this->countRows('action_document'));
        self::assertSame(0, $this->countRows('question_document'));
        $this->getAs('/api/actions/'.$action->getId());
        self::assertResponseIsSuccessful();
        self::assertSame([], $this->responseData()['documents']);
    }

    public function testDeletingAnActionKeepsItsDocuments(): void
    {
        $document = $this->createDocument('Rapport.pdf');
        $action = $this->createAction();
        $this->jsonAs('POST', '/api/actions/'.$action->getId().'/documents', ['documentId' => (string) $document->getId()]);

        $this->jsonAs('DELETE', '/api/actions/'.$action->getId());

        self::assertResponseStatusCodeSame(204);
        self::assertSame(1, $this->countRows('document'));
        $this->getAs('/api/documents');
        self::assertSame([], $this->responseList()[0]['actions']);
    }

    public function testNothingIsLinkedAcrossOrganizations(): void
    {
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $spy = $this->createUser('spy@globex.test', $globex);
        $spyToken = $this->issueToken($spy);
        $ownDocument = $this->createDocument('DUERP Acme.pdf');
        $ownAction = $this->createAction();
        $foreignDocument = $this->createDocument('Secret Globex.pdf', organization: $globex, author: $spy);
        $foreignAction = $this->createAction('Action Globex', $globex, $spy);

        // Acme cannot use what belongs to Globex...
        $this->jsonAs('POST', '/api/actions/'.$ownAction->getId().'/documents', ['documentId' => (string) $foreignDocument->getId()]);
        self::assertResponseStatusCodeSame(404);
        $this->jsonAs('POST', '/api/actions/'.$foreignAction->getId().'/documents', ['documentId' => (string) $ownDocument->getId()]);
        self::assertResponseStatusCodeSame(404);
        $this->jsonAs('PUT', '/api/question-documents', ['questionId' => self::QUESTION, 'documentId' => (string) $foreignDocument->getId()]);
        self::assertResponseStatusCodeSame(404);

        // ...nor Globex what belongs to Acme.
        $this->jsonAs('POST', '/api/actions/'.$foreignAction->getId().'/documents', ['documentId' => (string) $ownDocument->getId()], $spyToken);
        self::assertResponseStatusCodeSame(404);
        $this->jsonAs('DELETE', '/api/actions/'.$ownAction->getId().'/documents/'.$ownDocument->getId(), token: $spyToken);
        self::assertResponseStatusCodeSame(404);

        self::assertSame(0, $this->countRows('action_document'));
        self::assertSame(0, $this->countRows('question_document'));
    }

    public function testAReaderSeesTheLinksButChangesNone(): void
    {
        $reader = $this->createUser('lea@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $this->entityManager->flush();
        $readerToken = $this->issueToken($reader);
        $document = $this->createDocument('Rapport.pdf');
        $action = $this->createAction();
        $this->jsonAs('POST', '/api/actions/'.$action->getId().'/documents', ['documentId' => (string) $document->getId()]);

        $this->getAs('/api/actions/'.$action->getId(), $readerToken);
        self::assertCount(1, $this->responseData()['documents']);

        $this->jsonAs('DELETE', '/api/actions/'.$action->getId().'/documents/'.$document->getId(), token: $readerToken);
        self::assertResponseStatusCodeSame(403);
        $this->jsonAs('PUT', '/api/question-documents', ['questionId' => self::QUESTION, 'documentId' => (string) $document->getId()], $readerToken);
        self::assertResponseStatusCodeSame(403);
        self::assertSame(1, $this->countRows('action_document'));
        self::assertSame(0, $this->countRows('question_document'));
    }

    public function testAnUnknownDocumentOrActionIsNotFound(): void
    {
        $action = $this->createAction();
        $document = $this->createDocument('Rapport.pdf');

        $this->jsonAs('POST', '/api/actions/'.$action->getId().'/documents', ['documentId' => '999999']);
        self::assertResponseStatusCodeSame(404);
        $this->jsonAs('POST', '/api/actions/'.$action->getId().'/documents', []);
        self::assertResponseStatusCodeSame(404);
        $this->jsonAs('POST', '/api/actions/999999/documents', ['documentId' => (string) $document->getId()]);
        self::assertResponseStatusCodeSame(404);
    }

    public function testADocumentProvesAQuestionFromOneDiagnosticToTheNext(): void
    {
        $document = $this->createDocument('DUERP 2026.pdf');

        $this->jsonAs('PUT', '/api/question-documents', ['questionId' => self::QUESTION, 'documentId' => (string) $document->getId()]);
        self::assertResponseStatusCodeSame(201);
        $this->jsonAs('PUT', '/api/question-documents', ['questionId' => self::QUESTION, 'documentId' => (string) $document->getId()]);
        self::assertResponseStatusCodeSame(200);

        $this->getAs('/api/documents');
        $label = static::getContainer()->get(Questionnaire::class)->question(self::QUESTION)['label'] ?? null;
        self::assertSame([['id' => self::QUESTION, 'label' => $label]], $this->responseList()[0]['questions']);

        $this->jsonAs('DELETE', '/api/question-documents', ['questionId' => self::QUESTION, 'documentId' => (string) $document->getId()]);
        self::assertResponseStatusCodeSame(204);
        self::assertSame(0, $this->countRows('question_document'));
        self::assertSame(1, $this->countRows('document'));
    }

    public function testAQuestionThatDoesNotExistIsRefused(): void
    {
        $document = $this->createDocument('Rapport.pdf');

        $this->jsonAs('PUT', '/api/question-documents', ['questionId' => 'safety.nothing.99', 'documentId' => (string) $document->getId()]);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('invalid_question', $this->responseData()['code']);
    }

    public function testTheScoreKnowsWhichQuestionsHaveADocument(): void
    {
        $document = $this->createDocument('DUERP 2026.pdf');
        $this->jsonAs('PUT', '/api/question-documents', ['questionId' => self::QUESTION, 'documentId' => (string) $document->getId()]);
        $this->answerEverything();

        $this->jsonAs('POST', '/api/diagnostics/current/submit');

        self::assertResponseIsSuccessful();
        $answers = array_column(DataServiceMock::$requests[0]['body']['answers'], 'has_document', 'question_id');
        self::assertTrue($answers[self::QUESTION]);
        self::assertFalse($answers['quality.processus.01']);
    }

    public function testEachDownloadAndViewIsLoggedOnceAMinute(): void
    {
        $paul = $this->createUser('paul@acme.test', $this->organization);
        $paulToken = $this->issueToken($paul);
        $document = $this->createDocument('Rapport.pdf', withFile: true);

        $this->getAs('/api/documents/'.$document->getId().'/download');
        self::assertResponseIsSuccessful();
        // A PDF viewer may load the file again at once: one line only.
        $this->getAs('/api/documents/'.$document->getId().'/download');
        $this->getAs('/api/documents/'.$document->getId().'/view', $paulToken);
        self::assertResponseIsSuccessful();

        $rows = $this->entityManager->getConnection()->fetchAllAssociative('SELECT accessed_by_id, kind FROM document_access ORDER BY id');
        self::assertSame([
            ['accessed_by_id' => $this->user->getId(), 'kind' => 'download'],
            ['accessed_by_id' => $paul->getId(), 'kind' => 'view'],
        ], $rows);
    }

    public function testOnlyAnAdministratorReadsTheAccessLog(): void
    {
        $admin = $this->createUser('admin@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Admin);
        $admin->setName('Alice', 'Martin');
        $this->entityManager->flush();
        $adminToken = $this->issueToken($admin);
        $document = $this->createDocument('Rapport.pdf', withFile: true);
        $this->getAs('/api/documents/'.$document->getId().'/download');

        $this->getAs('/api/documents/'.$document->getId().'/accesses', $adminToken);
        self::assertResponseIsSuccessful();
        $accesses = $this->responseList();
        self::assertCount(1, $accesses);
        self::assertSame(self::EMAIL, $accesses[0]['by']['email']);
        self::assertSame('download', $accesses[0]['kind']);

        $this->getAs('/api/documents/'.$document->getId().'/accesses');
        self::assertResponseStatusCodeSame(403);
        self::assertSame(DocumentController::ACCESSES_FORBIDDEN, $this->responseData()['error']);
    }

    public function testAnotherOrganizationNeverReadsNorFillsTheAccessLog(): void
    {
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $spy = $this->createUser('spy@globex.test', $globex)->setOrganizationRole(OrganizationRole::Admin);
        $this->entityManager->flush();
        $spyToken = $this->issueToken($spy);
        $document = $this->createDocument('Rapport.pdf', withFile: true);

        $this->getAs('/api/documents/'.$document->getId().'/download', $spyToken);
        self::assertResponseStatusCodeSame(404);
        $this->getAs('/api/documents/'.$document->getId().'/accesses', $spyToken);
        self::assertResponseStatusCodeSame(404);
        self::assertSame(0, $this->countRows('document_access'));
    }

    /**
     * @param list<string> $names
     */
    private function assertListed(string $query, array $names): void
    {
        $this->getAs('/api/documents'.$query);

        self::assertResponseIsSuccessful();
        self::assertSame($names, array_column($this->responseList(), 'name'), $query);
    }

    private function createDocument(
        string $name,
        string $mimeType = 'application/pdf',
        ?QhsePillar $pillar = null,
        ?User $author = null,
        ?Organization $organization = null,
        bool $withFile = false,
    ): Document {
        $storedName = bin2hex(random_bytes(16));
        $document = new Document($organization ?? $this->organization, $name, $storedName, $mimeType, \strlen(self::PDF), $pillar, $author ?? $this->user);
        $this->entityManager->persist($document);
        $this->entityManager->flush();

        if ($withFile) {
            $path = static::getContainer()->get(DocumentStorage::class)->path($storedName);
            if (!is_dir(\dirname($path))) {
                mkdir(\dirname($path), recursive: true);
            }
            file_put_contents($path, self::PDF);
            $this->storedFiles[] = $storedName;
        }

        // Created in order: one second apart for the sort by date.
        $this->entityManager->getConnection()->executeStatement(
            'UPDATE document SET created_at = created_at + make_interval(secs => ?) WHERE id = ?',
            [$this->countRows('document'), $document->getId()],
        );

        return $document;
    }

    private function createAction(string $title = 'Vérifier les extincteurs', ?Organization $organization = null, ?User $assignee = null): Action
    {
        $assignee ??= $this->user;
        $action = new Action($organization ?? $this->organization, $title, '', QhsePillar::Safety, ActionType::Preventive, new \DateTimeImmutable('+10 days'), $assignee, $assignee);
        $this->entityManager->persist($action);
        $this->entityManager->flush();

        return $action;
    }

    private function countRows(string $table): int
    {
        return (int) $this->entityManager->getConnection()->fetchOne(\sprintf('SELECT COUNT(*) FROM %s', $table));
    }

    private function answerEverything(): void
    {
        foreach (static::getContainer()->get(Questionnaire::class)->toArray()['pillars'] as $pillar) {
            foreach ($pillar['themes'] as $theme) {
                foreach ($theme['questions'] as $question) {
                    $this->jsonAs('PUT', '/api/diagnostics/current/answers', [
                        'questionId' => $question['id'],
                        'value' => match ($question['type']) {
                            'yes_no' => 'yes',
                            'scale' => 0,
                            'single_choice' => $question['options'][0]['id'],
                            'multi_choice' => [],
                            default => 'Texte',
                        },
                    ]);
                    self::assertResponseIsSuccessful();
                }
            }
        }
    }
}
