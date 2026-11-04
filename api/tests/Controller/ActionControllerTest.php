<?php

namespace App\Tests\Controller;

use App\Controller\ActionController;
use App\Entity\Action;
use App\Entity\ActionType;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Entity\QhsePillar;
use App\Entity\User;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Mime\Email;

/**
 * US-09. The logged-in user of ProfileTestCase is a member of Acme; Paul is
 * a colleague. Fixtures are created before the first request: requests
 * reboot the kernel, so the entity manager.
 */
final class ActionControllerTest extends ProfileTestCase
{
    private User $colleague;

    protected function setUp(): void
    {
        parent::setUp();
        $this->colleague = $this->createUser('paul.martin@acme.test', $this->organization)->setName('Paul', 'Martin');
        $this->entityManager->flush();
    }

    public function testAMemberCreatesAnActionAndTheAssigneeIsToldByEmail(): void
    {
        $this->jsonAs('POST', '/api/actions', $this->payload());

        self::assertResponseStatusCodeSame(201);
        $action = $this->responseData();
        self::assertSame('Mettre à jour le DUERP', $action['title']);
        self::assertSame('safety', $action['domain']);
        self::assertSame('corrective', $action['type']);
        self::assertSame('todo', $action['status']);
        self::assertSame(self::inDays(10), $action['dueDate']);
        self::assertSame((string) $this->colleague->getId(), $action['assignee']['id']);
        self::assertSame('Claire', $action['createdBy']['firstName']);
        self::assertCount(1, $action['history']);
        self::assertNull($action['history'][0]['from']);
        self::assertSame('todo', $action['history'][0]['to']);
        self::assertSame((string) $this->user->getId(), $action['history'][0]['by']['id']);

        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame('paul.martin@acme.test', $email->getTo()[0]->getAddress());
        self::assertSame('Une action vous est confiée : Mettre à jour le DUERP', $email->getSubject());
        self::assertStringContainsString('Claire Dupont vous a confié une action', (string) $email->getTextBody());
        self::assertStringContainsString('/actions/'.$action['id'], (string) $email->getTextBody());
        self::assertStringContainsString('Domaine : Sécurité', (string) $email->getTextBody());
    }

    public function testNoEmailWhenTheAuthorTakesTheActionThemselves(): void
    {
        $this->jsonAs('POST', '/api/actions', ['assigneeId' => (string) $this->user->getId()] + $this->payload());

        self::assertResponseStatusCodeSame(201);
        self::assertEmailCount(0);
    }

    public function testTodayIsAValidDueDate(): void
    {
        $today = (new \DateTimeImmutable('now', new \DateTimeZone('Europe/Paris')))->format('Y-m-d');

        $this->jsonAs('POST', '/api/actions', ['dueDate' => $today] + $this->payload());

        self::assertResponseStatusCodeSame(201);
    }

    /**
     * @return iterable<string, array{array<string, mixed>, string, string}>
     */
    public static function invalidFields(): iterable
    {
        yield 'no title' => [['title' => '  '], 'title', 'Donnez un titre à l\'action.'];
        yield 'title too long' => [['title' => str_repeat('a', 121)], 'title', 'Le titre ne doit pas dépasser 120 caractères.'];
        yield 'description too long' => [['description' => str_repeat('a', 2001)], 'description', 'La description ne doit pas dépasser 2000 caractères.'];
        yield 'unknown domain' => [['domain' => 'finance'], 'domain', 'Choisissez le domaine de l\'action.'];
        yield 'unknown type' => [['type' => 'urgent'], 'type', 'Choisissez le type d\'action : corrective, préventive ou amélioration.'];
        yield 'no assignee' => [['assigneeId' => null], 'assigneeId', 'Choisissez le responsable de l\'action.'];
        yield 'unknown assignee' => [['assigneeId' => '999999'], 'assigneeId', 'Choisissez le responsable parmi les membres de votre organisation.'];
        yield 'no due date' => [['dueDate' => ''], 'dueDate', 'Indiquez l\'échéance de l\'action.'];
        yield 'impossible due date' => [['dueDate' => '2030-02-30'], 'dueDate', 'Indiquez l\'échéance de l\'action.'];
        yield 'past due date' => [['dueDate' => '2020-01-15'], 'dueDate', 'L\'échéance ne peut pas être dans le passé.'];
    }

    /**
     * @param array<string, mixed> $change
     */
    #[DataProvider('invalidFields')]
    public function testAnInvalidActionIsRefusedWithAMessagePerField(array $change, string $field, string $message): void
    {
        $this->jsonAs('POST', '/api/actions', $change + $this->payload());

        self::assertResponseStatusCodeSame(422);
        $data = $this->responseData();
        self::assertSame('invalid_action', $data['code']);
        self::assertSame([$field => $message], $data['fields']);
        self::assertSame(0, $this->countActions());
        self::assertEmailCount(0);
    }

    public function testAnActionIsNeverGivenToSomeoneOfAnotherOrganization(): void
    {
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $outsider = $this->createUser('spy@globex.test', $globex);

        $this->jsonAs('POST', '/api/actions', ['assigneeId' => (string) $outsider->getId()] + $this->payload());

        self::assertResponseStatusCodeSame(422);
        // Same words as for an unknown user: nobody learns the account exists.
        self::assertSame(['assigneeId' => 'Choisissez le responsable parmi les membres de votre organisation.'], $this->responseData()['fields']);
        self::assertSame(0, $this->countActions());
        self::assertEmailCount(0);
    }

    public function testAReaderOrAnInactiveAccountCannotBeTheAssignee(): void
    {
        $reader = $this->createUser('lea@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $inactive = (new User('nina@acme.test'))->setOrganization($this->organization);
        $this->entityManager->persist($inactive);
        $this->entityManager->flush();

        $this->jsonAs('POST', '/api/actions', ['assigneeId' => (string) $reader->getId()] + $this->payload());
        self::assertResponseStatusCodeSame(422);
        self::assertStringContainsString('Un lecteur ne peut pas être responsable', $this->responseData()['fields']['assigneeId']);

        $this->jsonAs('POST', '/api/actions', ['assigneeId' => (string) $inactive->getId()] + $this->payload());
        self::assertResponseStatusCodeSame(422);
        self::assertStringContainsString('pas encore activé son compte', $this->responseData()['fields']['assigneeId']);
    }

    public function testTheListShowsOnlyTheOwnOrganizationSoonestFirst(): void
    {
        $later = $this->createAction($this->organization, $this->colleague, 30, 'Plus tard');
        $sooner = $this->createAction($this->organization, $this->colleague, 3, 'Bientôt');
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $this->createAction($globex, $this->createUser('boss@globex.test', $globex), 1, 'Secret de Globex');

        $this->getAs('/api/actions');

        self::assertResponseIsSuccessful();
        $actions = $this->responseList();
        self::assertSame([(string) $sooner->getId(), (string) $later->getId()], array_column($actions, 'id'));
        self::assertArrayNotHasKey('history', $actions[0]);
    }

    public function testAnotherOrganizationsActionIsNeverFoundNorChanged(): void
    {
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $secret = $this->createAction($globex, $this->createUser('boss@globex.test', $globex), 5, 'Secret de Globex');
        $uri = '/api/actions/'.$secret->getId();
        $before = $this->actionRow((int) $secret->getId());

        $this->getAs($uri);
        self::assertResponseStatusCodeSame(404);
        $this->jsonAs('PATCH', $uri, $this->payload());
        self::assertResponseStatusCodeSame(404);
        $this->jsonAs('POST', $uri.'/status', ['status' => 'in_progress']);
        self::assertResponseStatusCodeSame(404);
        $this->jsonAs('DELETE', $uri);
        self::assertResponseStatusCodeSame(404);

        self::assertSame($before, $this->actionRow((int) $secret->getId()));
    }

    public function testAReaderConsultsButNeverWrites(): void
    {
        $reader = $this->createUser('lea@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $this->entityManager->flush();
        $readerToken = $this->issueToken($reader);
        $action = $this->createAction($this->organization, $this->colleague, 5);
        $uri = '/api/actions/'.$action->getId();

        $this->getAs('/api/actions', $readerToken);
        self::assertResponseIsSuccessful();
        $this->getAs($uri, $readerToken);
        self::assertResponseIsSuccessful();

        foreach ([['POST', '/api/actions'], ['PATCH', $uri], ['DELETE', $uri], ['POST', $uri.'/status']] as [$method, $target]) {
            $this->jsonAs($method, $target, ['status' => 'in_progress'] + $this->payload(), $readerToken);
            self::assertResponseStatusCodeSame(403, $method.' '.$target);
        }
        self::assertSame(1, $this->countActions());
    }

    public function testAMemberEditsAnActionAndANewAssigneeIsTold(): void
    {
        $nina = $this->createUser('nina.roux@acme.test', $this->organization)->setName('Nina', 'Roux');
        $this->entityManager->flush();
        $action = $this->createAction($this->organization, $this->colleague, 5);
        $uri = '/api/actions/'.$action->getId();

        $this->jsonAs('PATCH', $uri, ['title' => 'Former l\'équipe', 'type' => 'preventive'] + $this->payload());
        self::assertResponseIsSuccessful();
        self::assertSame('Former l\'équipe', $this->responseData()['title']);
        self::assertSame('preventive', $this->responseData()['type']);
        // Same assignee: no e-mail.
        self::assertEmailCount(0);

        $this->jsonAs('PATCH', $uri, ['assigneeId' => (string) $nina->getId()] + $this->payload());
        self::assertResponseIsSuccessful();
        self::assertSame('Nina', $this->responseData()['assignee']['firstName']);
        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame('nina.roux@acme.test', $email->getTo()[0]->getAddress());
    }

    public function testALateActionCanBeEditedWithoutMovingItsDueDateToThePast(): void
    {
        $late = $this->createAction($this->organization, $this->colleague, -3);
        $uri = '/api/actions/'.$late->getId();

        $this->jsonAs('PATCH', $uri, ['dueDate' => self::inDays(-3), 'title' => 'Toujours en retard'] + $this->payload());
        self::assertResponseIsSuccessful();

        $this->jsonAs('PATCH', $uri, ['dueDate' => self::inDays(-10)] + $this->payload());
        self::assertResponseStatusCodeSame(422);
        self::assertSame(['dueDate' => 'L\'échéance ne peut pas être dans le passé.'], $this->responseData()['fields']);
    }

    public function testAMemberDeletesAnActionWithItsHistory(): void
    {
        $action = $this->createAction($this->organization, $this->user, 5);

        $this->jsonAs('DELETE', '/api/actions/'.$action->getId());

        self::assertResponseStatusCodeSame(204);
        self::assertSame(0, $this->countActions());
        self::assertSame(0, (int) $this->entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM action_status_change'));
    }

    public function testTheAssigneeMovesTheStatusOneStepAtATimeAndItIsKept(): void
    {
        $action = $this->createAction($this->organization, $this->user, 5);
        $uri = '/api/actions/'.$action->getId().'/status';

        foreach (['in_progress', 'in_review', 'done', 'in_review'] as $status) {
            $this->jsonAs('POST', $uri, ['status' => $status]);
            self::assertResponseIsSuccessful();
        }

        $data = $this->responseData();
        self::assertSame('in_review', $data['status']);
        self::assertSame(
            [[null, 'todo'], ['todo', 'in_progress'], ['in_progress', 'in_review'], ['in_review', 'done'], ['done', 'in_review']],
            array_map(static fn (array $change): array => [$change['from'], $change['to']], $data['history']),
        );
        self::assertSame((string) $this->user->getId(), $data['history'][4]['by']['id']);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function refusedStatuses(): iterable
    {
        yield 'skips a step' => ['in_review'];
        yield 'same status' => ['todo'];
        yield 'unknown' => ['blocked'];
    }

    #[DataProvider('refusedStatuses')]
    public function testAStatusThatIsNotTheNextOrPreviousStepIsRefused(string $status): void
    {
        $action = $this->createAction($this->organization, $this->user, 5);

        $this->jsonAs('POST', '/api/actions/'.$action->getId().'/status', ['status' => $status]);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('invalid_status', $this->responseData()['code']);
    }

    public function testOnlyTheAssigneeOrAnAdministratorMovesTheStatus(): void
    {
        $admin = $this->createUser('admin@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Admin);
        $this->entityManager->flush();
        $adminToken = $this->issueToken($admin);
        $action = $this->createAction($this->organization, $this->colleague, 5);
        $uri = '/api/actions/'.$action->getId().'/status';

        // The logged-in member is not the assignee.
        $this->jsonAs('POST', $uri, ['status' => 'in_progress']);
        self::assertResponseStatusCodeSame(403);
        self::assertSame(ActionController::STATUS_FORBIDDEN, $this->responseData()['error']);

        $this->jsonAs('POST', $uri, ['status' => 'in_progress'], $adminToken);
        self::assertResponseIsSuccessful();
        self::assertSame('in_progress', $this->responseData()['status']);
    }

    public function testTheActionStaysWhenItsAssigneeLeaves(): void
    {
        $admin = $this->createUser('admin@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Admin);
        $this->entityManager->flush();
        $adminToken = $this->issueToken($admin);
        $action = $this->createAction($this->organization, $this->colleague, 5);

        $this->jsonAs('DELETE', '/api/users/'.$this->colleague->getId(), token: $adminToken);
        self::assertResponseStatusCodeSame(204);

        $this->getAs('/api/actions/'.$action->getId());
        self::assertResponseIsSuccessful();
        self::assertNull($this->responseData()['assignee']);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'title' => 'Mettre à jour le DUERP',
            'description' => 'Revoir les risques de l\'atelier avec le CSE.',
            'domain' => 'safety',
            'type' => 'corrective',
            'assigneeId' => (string) $this->colleague->getId(),
            'dueDate' => self::inDays(10),
        ];
    }

    private static function inDays(int $days): string
    {
        return (new \DateTimeImmutable('now', new \DateTimeZone('Europe/Paris')))->modify(\sprintf('%+d days', $days))->format('Y-m-d');
    }

    private function createAction(Organization $organization, User $assignee, int $dueInDays, string $title = 'Vérifier les extincteurs'): Action
    {
        $action = new Action($organization, $title, '', QhsePillar::Safety, ActionType::Preventive, new \DateTimeImmutable(self::inDays($dueInDays)), $assignee, $assignee);
        $this->entityManager->persist($action);
        $this->entityManager->flush();

        return $action;
    }

    private function countActions(): int
    {
        return (int) $this->entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM qhse_action');
    }

    /**
     * @return array<string, mixed>|false
     */
    private function actionRow(int $id): array|false
    {
        return $this->entityManager->getConnection()->fetchAssociative('SELECT * FROM qhse_action WHERE id = ?', [$id]);
    }
}
