<?php

namespace App\Tests\Controller\Admin;

use App\Entity\AdminAction;
use App\Entity\Document;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Entity\User;
use App\Mailer\ActivationMailer;
use App\Security\ActivationTokenManager;
use App\Storage\AvatarStorage;
use App\Storage\DocumentStorage;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\MailerInterface;

/**
 * /api/admin/organizations: the REGLO team creates, renames and deletes the
 * client organizations, and adds accounts to them.
 */
final class AdminOrganizationControllerTest extends AdminTestCase
{
    private const NEW_ORGANIZATION = [
        'name' => '  Globex   SAS ',
        'adminEmail' => 'Jeanne@Globex.test',
        'adminFirstName' => 'Jeanne',
        'adminLastName' => 'Martin',
    ];

    public function testListsTheOrganizationsWithTheirNumberOfAccounts(): void
    {
        $this->entityManager->persist((new User('new@acme.test'))->setOrganization($this->organization));
        $this->entityManager->persist(new Organization('Zeta'));
        $this->entityManager->flush();

        $this->adminGet('/api/admin/organizations');

        self::assertResponseIsSuccessful();
        $list = $this->responseList();
        self::assertSame(['Acme', 'Zeta'], array_column($list, 'name'));
        self::assertSame([2, 0], array_column($list, 'userCount'));
        self::assertSame([1, 0], array_column($list, 'pendingCount'));
        self::assertSame(['id', 'name', 'createdAt', 'userCount', 'pendingCount'], array_keys($list[0]));
    }

    public function testCreatesAnOrganizationAndItsFirstAdministrator(): void
    {
        $this->adminCall('POST', '/api/admin/organizations', self::NEW_ORGANIZATION);

        self::assertResponseStatusCodeSame(201);
        $data = $this->responseData();
        self::assertSame('Globex SAS', $data['name']);
        self::assertSame('jeanne@globex.test', $data['adminEmail']);
        self::assertTrue($data['emailSent']);

        $admin = $this->findUser('jeanne@globex.test');
        self::assertNotNull($admin);
        self::assertSame('Globex SAS', $admin->getOrganization()?->getName());
        self::assertSame(OrganizationRole::Admin, $admin->getOrganizationRole());
        self::assertFalse($admin->isActivated());
        self::assertFalse($admin->isPlatformAdmin());

        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertNotNull($email);
        self::assertEmailAddressContains($email, 'To', 'jeanne@globex.test');
        self::assertEmailTextBodyContains($email, "pour l'organisation Globex SAS");
        $this->assertAudited(AdminAction::OrganizationCreated, 'Globex SAS, jeanne@globex.test');
    }

    public function testSaysWhenTheEmailCouldNotBeSent(): void
    {
        $failing = $this->createStub(MailerInterface::class);
        $failing->method('send')->willThrowException(new TransportException('SMTP down at 10.0.0.1'));
        static::getContainer()->set(ActivationMailer::class, new ActivationMailer(
            $failing,
            static::getContainer()->get(ActivationTokenManager::class),
            'https://reglo.test',
            'noreply@reglo.test',
            3600,
        ));
        $this->client->disableReboot();

        $this->adminCall('POST', '/api/admin/organizations', self::NEW_ORGANIZATION);

        self::assertResponseStatusCodeSame(201);
        self::assertFalse($this->responseData()['emailSent']);
        self::assertStringNotContainsString('10.0.0.1', (string) $this->client->getResponse()->getContent());
        self::assertNotNull($this->findUser('jeanne@globex.test'));
    }

    public function testRefusesATakenNameOrEmail(): void
    {
        $this->adminCall('POST', '/api/admin/organizations', [
            'name' => 'ACME',
            'adminEmail' => self::EMAIL,
        ] + self::NEW_ORGANIZATION);

        $this->assertInvalidFields(['name', 'email']);
        self::assertEmailCount(0);
        $this->assertNothingAudited();
    }

    public function testRefusesMissingDetails(): void
    {
        $this->adminCall('POST', '/api/admin/organizations', []);

        $this->assertInvalidFields(['name', 'email', 'firstName', 'lastName']);
    }

    public function testRefusesAnInvalidOrTooLongEmail(): void
    {
        foreach (['not-an-email', str_repeat('a', 180).'@globex.test'] as $email) {
            $this->adminCall('POST', '/api/admin/organizations', ['adminEmail' => $email] + self::NEW_ORGANIZATION);

            $this->assertInvalidFields(['email']);
        }
    }

    public function testShowsAnOrganizationWithItsAccountsOnly(): void
    {
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $this->createUser('other@globex.test', $globex);

        $this->adminGet('/api/admin/organizations/'.$this->organization->getId());

        self::assertResponseIsSuccessful();
        $data = $this->responseData();
        self::assertSame('Acme', $data['name']);
        self::assertIsArray($data['users']);
        self::assertCount(1, $data['users']);
        self::assertIsArray($data['users'][0]);
        self::assertSame(self::EMAIL, $data['users'][0]['email']);
        // What is needed to manage an access: no job title, no photo...
        self::assertSame(
            ['id', 'email', 'firstName', 'lastName', 'role', 'activated', 'joinedAt', 'lastSeenAt', 'organization'],
            array_keys($data['users'][0]),
        );
    }

    public function testAnOrganizationThatDoesNotExistIsNotFound(): void
    {
        $this->adminGet('/api/admin/organizations/999999');
        self::assertResponseStatusCodeSame(404);

        foreach (['PATCH' => '', 'DELETE' => '', 'POST' => '/users'] as $method => $suffix) {
            $this->adminCall($method, '/api/admin/organizations/999999'.$suffix);
            self::assertResponseStatusCodeSame(404);
        }
    }

    public function testRenamesAnOrganization(): void
    {
        $this->adminCall('PATCH', '/api/admin/organizations/'.$this->organization->getId(), ['name' => ' Acme   Group ']);

        self::assertResponseIsSuccessful();
        self::assertSame('Acme Group', $this->responseData()['name']);
        $this->assertAudited(AdminAction::OrganizationRenamed, 'Acme -> Acme Group');
        self::assertSame('Acme Group', $this->findUser(self::EMAIL)?->getOrganization()?->getName());
    }

    public function testAnOrganizationCanChangeTheCaseOfItsName(): void
    {
        $this->adminCall('PATCH', '/api/admin/organizations/'.$this->organization->getId(), ['name' => 'ACME']);

        self::assertResponseIsSuccessful();
        self::assertSame('ACME', $this->responseData()['name']);
    }

    public function testTheSameNameChangesNothing(): void
    {
        $this->adminCall('PATCH', '/api/admin/organizations/'.$this->organization->getId(), ['name' => 'Acme']);

        self::assertResponseIsSuccessful();
        $this->assertNothingAudited();
    }

    public function testRefusesTheNameOfAnotherOrganizationOrAnEmptyOne(): void
    {
        $this->entityManager->persist(new Organization('Globex'));
        $this->entityManager->flush();

        foreach (['globex', '   '] as $name) {
            $this->adminCall('PATCH', '/api/admin/organizations/'.$this->organization->getId(), ['name' => $name]);

            $this->assertInvalidFields(['name']);
        }
        $this->assertNothingAudited();
    }

    public function testDeletionNeedsTheExactName(): void
    {
        foreach ([[], ['confirmName' => 'acme'], ['confirmName' => 'Acm']] as $body) {
            $this->adminCall('DELETE', '/api/admin/organizations/'.$this->organization->getId(), $body);

            $this->assertRefused('confirmation_mismatch');
        }

        self::assertNotNull($this->findUser(self::EMAIL));
        $this->assertNothingAudited();
    }

    public function testDeletesAnOrganizationWithItsAccountsDataAndFiles(): void
    {
        $document = str_repeat('b', 32);
        $avatar = str_repeat('c', 32).'.webp';
        $documentPath = $this->putFile(static::getContainer()->get(DocumentStorage::class)->path($document));
        $avatarPath = $this->putFile(static::getContainer()->get(AvatarStorage::class)->path($avatar));
        $this->user->setAvatarFile($avatar);
        $this->entityManager->persist(new Document($this->organization, 'duerp.pdf', $document, 'application/pdf', 3, null, $this->user));

        // Another client keeps everything.
        $otherDocument = str_repeat('d', 32);
        $otherPath = $this->putFile(static::getContainer()->get(DocumentStorage::class)->path($otherDocument));
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $other = $this->createUser('other@globex.test', $globex);
        $this->entityManager->persist(new Document($globex, 'autre.pdf', $otherDocument, 'application/pdf', 3, null, $other));
        $this->entityManager->flush();
        $token = $this->token;

        $this->adminCall('DELETE', '/api/admin/organizations/'.$this->organization->getId(), ['confirmName' => 'Acme']);

        self::assertResponseStatusCodeSame(204);
        $connection = $this->entityManager->getConnection();
        self::assertSame(['Globex'], $connection->fetchFirstColumn('SELECT name FROM organization'));
        self::assertSame(['other@globex.test', self::TEAM_EMAIL], $connection->fetchFirstColumn('SELECT email FROM app_user ORDER BY id DESC'));
        self::assertSame([$otherDocument], $connection->fetchFirstColumn('SELECT stored_name FROM document'));
        self::assertFileDoesNotExist($documentPath);
        self::assertFileDoesNotExist($avatarPath);
        self::assertFileExists($otherPath);
        self::assertFalse($this->isTokenValid($token));
        $this->assertAudited(AdminAction::OrganizationDeleted, 'Acme');

        unlink($otherPath);
    }

    public function testAddsAnAccountToAnOrganizationWithTheChosenRole(): void
    {
        $this->adminCall('POST', '/api/admin/organizations/'.$this->organization->getId().'/users', [
            'email' => 'paul@acme.test',
            'firstName' => 'Paul',
            'lastName' => 'Durand',
            'role' => 'reader',
        ]);

        self::assertResponseStatusCodeSame(201);
        $data = $this->responseData();
        self::assertSame('reader', $data['role']);
        self::assertFalse($data['activated']);
        self::assertTrue($data['emailSent']);

        $user = $this->findUser('paul@acme.test');
        self::assertSame($this->organization->getId(), $user?->getOrganization()?->getId());
        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertNotNull($email);
        // The e-mail does not promise a role the person does not have.
        self::assertEmailTextBodyContains($email, 'Un compte a été créé pour vous');
        $this->assertAudited(AdminAction::UserCreated, 'paul@acme.test, Acme, reader');
    }

    public function testRefusesAWrongRoleOrATakenEmailWhenAddingAnAccount(): void
    {
        $uri = '/api/admin/organizations/'.$this->organization->getId().'/users';
        $names = ['firstName' => 'Paul', 'lastName' => 'Durand'];

        foreach (['', 'superadmin', User::ROLE_PLATFORM_ADMIN] as $role) {
            $this->adminCall('POST', $uri, ['email' => 'paul@acme.test', 'role' => $role] + $names);
            $this->assertRefused('invalid_role');
        }

        $this->adminCall('POST', $uri, ['email' => self::TEAM_EMAIL, 'role' => 'member'] + $names);
        $this->assertInvalidFields(['email']);

        self::assertNull($this->findUser('paul@acme.test'));
        self::assertEmailCount(0);
    }

    private function putFile(string $path): string
    {
        if (!is_dir(\dirname($path))) {
            mkdir(\dirname($path), recursive: true);
        }
        file_put_contents($path, 'content');

        return $path;
    }
}
