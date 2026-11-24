<?php

namespace App\Tests\Controller;

use App\Controller\PersonalDataController;
use App\Entity\Action;
use App\Entity\ActionStatus;
use App\Entity\ActionType;
use App\Entity\Diagnostic;
use App\Entity\Document;
use App\Entity\OrganizationRole;
use App\Entity\QhsePillar;
use App\Entity\User;
use Symfony\Component\Mime\Email;

/**
 * US-04: the GDPR rights of the signed-in user, the export of their personal
 * data and the deletion of their account. The logged-in user of
 * ProfileTestCase is a member of Acme.
 */
final class PersonalDataTest extends ProfileTestCase
{
    public function testTheExportHoldsTheProfileAndWhatTheUserDid(): void
    {
        $paul = $this->createUser('paul@acme.test', $this->organization);
        $this->user->setJobTitle('Responsable QHSE');
        $assigned = $this->createAction('Vérifier les extincteurs', $this->user, $paul);
        $this->createAction('Former au maniement', $paul, $this->user);
        $assigned->moveTo(ActionStatus::InProgress, $this->user);
        $this->createAction('Action de Paul', $paul, $paul);
        $this->createDocument('DUERP 2026.pdf', $this->user);
        $this->createDocument('Photo de Paul.jpg', $paul);
        $diagnostic = new Diagnostic($this->organization, 'v1', $this->user);
        $diagnostic->answer('quality.pilotage.01', 'yes', false, $this->user);
        $diagnostic->answer('quality.pilotage.02', 'no', false, $paul);
        $this->entityManager->persist($diagnostic);
        $this->entityManager->flush();

        $this->getAs('/api/me/export');

        self::assertResponseIsSuccessful();
        self::assertResponseHeaderSame('Content-Type', 'application/json; charset=utf-8');
        self::assertResponseHeaderSame('X-Content-Type-Options', 'nosniff');
        self::assertMatchesRegularExpression('/^attachment; filename=reglo-mes-donnees-\d{4}-\d{2}-\d{2}\.json$/', (string) $this->client->getResponse()->headers->get('Content-Disposition'));
        $data = $this->responseData();
        self::assertSame(self::EMAIL, $data['profile']['email']);
        self::assertSame(['Claire', 'Dupont', 'Responsable QHSE', 'member'], [$data['profile']['firstName'], $data['profile']['lastName'], $data['profile']['jobTitle'], $data['profile']['role']]);
        self::assertSame(['name' => 'Acme'], $data['organization']);
        self::assertSame(['Vérifier les extincteurs'], array_column($data['actionsAssigned'], 'title'));
        self::assertSame(['Former au maniement'], array_column($data['actionsCreated'], 'title'));
        self::assertSame('in_progress', $data['actionStatusChanges'][array_key_last($data['actionStatusChanges'])]['to']);
        // Only their own documents and answers.
        self::assertSame(['DUERP 2026.pdf'], array_column($data['documentsUploaded'], 'name'));
        self::assertCount(1, $data['diagnosticAnswers']);
        self::assertSame('yes', $data['diagnosticAnswers'][0]['value']);
        self::assertStringEndsWith('?', $data['diagnosticAnswers'][0]['question']);
        self::assertStringNotContainsString('paul@acme.test', (string) $this->client->getResponse()->getContent());
    }

    public function testAReaderExportsAndDeletesTheirAccountToo(): void
    {
        $reader = $this->createUser('lea@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $this->entityManager->flush();
        $readerToken = $this->issueToken($reader);

        $this->getAs('/api/me/export', $readerToken);
        self::assertResponseIsSuccessful();
        self::assertSame('reader', $this->responseData()['profile']['role']);

        $this->jsonAs('DELETE', '/api/me', ['password' => self::PASSWORD], $readerToken);
        self::assertResponseStatusCodeSame(204);
    }

    public function testAWrongPasswordDeletesNothing(): void
    {
        foreach ([['password' => 'not-the-password'], []] as $body) {
            $this->jsonAs('DELETE', '/api/me', $body);

            self::assertResponseStatusCodeSame(422);
            self::assertSame(PersonalDataController::WRONG_PASSWORD, $this->responseData()['error']);
        }
        self::assertSame(self::EMAIL, $this->userColumn('email'));
        self::assertTrue($this->isTokenValid($this->token));
        self::assertEmailCount(0);
    }

    public function testDeletingTheAccountErasesTheUserButKeepsTheDataOfTheOrganization(): void
    {
        $action = $this->createAction('Vérifier les extincteurs', $this->user, $this->user);
        $document = $this->createDocument('DUERP 2026.pdf', $this->user);
        $otherSession = $this->issueToken($this->user);
        $userId = $this->user->getId();

        $this->jsonAs('DELETE', '/api/me', ['password' => self::PASSWORD]);

        self::assertResponseStatusCodeSame(204);
        // The e-mail of this request, before any other one.
        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame(self::EMAIL, $email->getTo()[0]->getAddress());
        self::assertSame('Votre compte Réglo a été supprimé', $email->getSubject());
        self::assertStringContainsString('Bonjour Claire', (string) $email->getTextBody());

        $connection = $this->entityManager->getConnection();
        self::assertFalse($connection->fetchOne('SELECT 1 FROM app_user WHERE id = ? OR email = ?', [$userId, self::EMAIL]));
        self::assertSame(0, (int) $connection->fetchOne('SELECT COUNT(*) FROM access_token WHERE user_id = ?', [$userId]));
        self::assertFalse($this->isTokenValid($this->token));
        self::assertFalse($this->isTokenValid($otherSession));
        // The organization keeps its action and document, without the name.
        self::assertSame(['assignee_id' => null, 'created_by_id' => null], $connection->fetchAssociative('SELECT assignee_id, created_by_id FROM qhse_action WHERE id = ?', [$action->getId()]));
        self::assertNull($connection->fetchOne('SELECT uploaded_by_id FROM document WHERE id = ?', [$document->getId()]));
    }

    public function testTheLastAdministratorCannotDeleteTheirAccount(): void
    {
        $this->user->setOrganizationRole(OrganizationRole::Admin);
        $this->entityManager->flush();

        $this->jsonAs('DELETE', '/api/me', ['password' => self::PASSWORD]);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(PersonalDataController::LAST_ADMIN, $this->responseData()['error']);
        self::assertSame(self::EMAIL, $this->userColumn('email'));
        self::assertEmailCount(0);
    }

    public function testAnAdministratorWithAColleagueAdministratorCanLeave(): void
    {
        $this->user->setOrganizationRole(OrganizationRole::Admin);
        $this->createUser('paul@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Admin);
        $this->entityManager->flush();

        $this->jsonAs('DELETE', '/api/me', ['password' => self::PASSWORD]);

        self::assertResponseStatusCodeSame(204);
    }

    public function testATeamAccountIsDeletedFromTheBackOfficeOnly(): void
    {
        $team = $this->createUser('team@reglo.test', null)->setRoles([User::ROLE_PLATFORM_ADMIN]);
        $this->entityManager->flush();
        $teamToken = $this->issueToken($team);

        $this->jsonAs('DELETE', '/api/me', ['password' => self::PASSWORD], $teamToken);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(PersonalDataController::TEAM_ACCOUNT, $this->responseData()['error']);
        self::assertTrue($this->isTokenValid($teamToken));
    }

    public function testAnonymousRequestsAreRefused(): void
    {
        $this->client->request('GET', '/api/me/export');
        self::assertResponseStatusCodeSame(401);
        $this->client->jsonRequest('DELETE', '/api/me', ['password' => self::PASSWORD]);
        self::assertResponseStatusCodeSame(401);
    }

    private function createAction(string $title, User $assignee, User $createdBy): Action
    {
        $action = new Action($this->organization, $title, '', QhsePillar::Safety, ActionType::Preventive, new \DateTimeImmutable('+10 days'), $assignee, $createdBy);
        $this->entityManager->persist($action);
        $this->entityManager->flush();

        return $action;
    }

    private function createDocument(string $name, User $author): Document
    {
        $document = new Document($this->organization, $name, bin2hex(random_bytes(16)), 'application/pdf', 1200, null, $author);
        $this->entityManager->persist($document);
        $this->entityManager->flush();

        return $document;
    }
}
