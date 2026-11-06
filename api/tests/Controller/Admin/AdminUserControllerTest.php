<?php

namespace App\Tests\Controller\Admin;

use App\Entity\AdminAction;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Entity\User;
use App\Security\ActivationTokenManager;
use App\Storage\AvatarStorage;
use Symfony\Component\Mime\Email;

/**
 * /api/admin/users and /api/admin/team: the accounts of the clients and of
 * the REGLO team.
 */
final class AdminUserControllerTest extends AdminTestCase
{
    public function testListsEveryClientAccountWithItsOrganization(): void
    {
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $this->createUser('other@globex.test', $globex)->setName('Zoé', 'Bernard');
        $this->createUser('test@reglo.test', null)->setName('Test', 'Compte');

        $this->adminGet('/api/admin/users');

        self::assertResponseIsSuccessful();
        $users = array_column($this->responseList(), null, 'email');
        // The REGLO team is on /team only.
        self::assertSame(['other@globex.test', 'test@reglo.test', self::EMAIL], array_keys($users));
        self::assertSame('Globex', $users['other@globex.test']['organization']['name'] ?? null);
        self::assertNull($users['test@reglo.test']['organization']);
    }

    public function testChangesTheRoleOfAnAccount(): void
    {
        $paul = $this->createUser('paul@acme.test', $this->organization);
        $this->makeAdmin($this->user);

        $this->adminCall('PATCH', '/api/admin/users/'.$paul->getId(), ['role' => 'reader']);

        self::assertResponseIsSuccessful();
        self::assertSame('reader', $this->responseData()['role']);
        self::assertSame(OrganizationRole::Reader, $this->findUser('paul@acme.test')?->getOrganizationRole());
        $this->assertAudited(AdminAction::UserRoleChanged, 'paul@acme.test -> reader');
    }

    public function testRefusesAWrongRole(): void
    {
        foreach (['', 'superadmin', User::ROLE_PLATFORM_ADMIN] as $role) {
            $this->adminCall('PATCH', '/api/admin/users/'.$this->user->getId(), ['role' => $role]);

            $this->assertRefused('invalid_role');
        }
        self::assertFalse($this->findUser(self::EMAIL)?->isPlatformAdmin());
    }

    public function testAnOrganizationKeepsItsLastAdministrator(): void
    {
        $this->makeAdmin($this->user);

        $this->adminCall('PATCH', '/api/admin/users/'.$this->user->getId(), ['role' => 'member']);
        $this->assertRefused('last_admin');

        $this->adminCall('DELETE', '/api/admin/users/'.$this->user->getId());
        $this->assertRefused('last_admin');

        self::assertSame(OrganizationRole::Admin, $this->findUser(self::EMAIL)?->getOrganizationRole());
        $this->assertNothingAudited();
    }

    public function testAnAccountWithoutOrganizationHasNoRoleToChange(): void
    {
        $orphan = $this->createUser('test@reglo.test', null);

        $this->adminCall('PATCH', '/api/admin/users/'.$orphan->getId(), ['role' => 'admin']);

        $this->assertRefused('no_organization');
    }

    public function testRemovesAnAccountWithItsSessionsAndPhoto(): void
    {
        $paul = $this->createUser('paul@acme.test', $this->organization);
        $paulToken = $this->issueToken($paul);
        $storage = static::getContainer()->get(AvatarStorage::class);
        $photo = str_repeat('e', 32).'.webp';
        if (!is_dir(\dirname($storage->path($photo)))) {
            mkdir(\dirname($storage->path($photo)), recursive: true);
        }
        file_put_contents($storage->path($photo), 'photo');
        $paul->setAvatarFile($photo);
        $this->entityManager->flush();

        $this->adminCall('DELETE', '/api/admin/users/'.$paul->getId());

        self::assertResponseStatusCodeSame(204);
        self::assertNull($this->findUser('paul@acme.test'));
        self::assertFileDoesNotExist($storage->path($photo));
        self::assertFalse($this->isTokenValid($paulToken));
        $this->assertAudited(AdminAction::UserRemoved, 'paul@acme.test');
    }

    public function testTheTeamIsNotManagedThroughTheUserRoutes(): void
    {
        $colleague = $this->createUser('colleague@reglo.test', null)->setRoles([User::ROLE_PLATFORM_ADMIN]);
        $this->entityManager->flush();

        $this->adminCall('PATCH', '/api/admin/users/'.$colleague->getId(), ['role' => 'admin']);
        self::assertResponseStatusCodeSame(404);

        $this->adminCall('DELETE', '/api/admin/users/'.$colleague->getId());
        self::assertResponseStatusCodeSame(404);

        self::assertNotNull($this->findUser('colleague@reglo.test'));
    }

    public function testAnAccountThatDoesNotExistIsNotFound(): void
    {
        foreach ([
            ['PATCH', '/api/admin/users/999999'],
            ['DELETE', '/api/admin/users/999999'],
            ['POST', '/api/admin/users/999999/resend-activation'],
            ['DELETE', '/api/admin/team/999999'],
        ] as [$method, $uri]) {
            $this->adminCall($method, $uri);

            self::assertResponseStatusCodeSame(404);
        }
    }

    public function testSendsANewActivationLinkThatReplacesThePreviousOne(): void
    {
        $pending = (new User('pending@acme.test'))->setOrganization($this->organization);
        $this->entityManager->persist($pending);
        $this->entityManager->flush();
        $tokens = static::getContainer()->get(ActivationTokenManager::class);
        $previous = $tokens->issue($pending);

        $this->adminCall('POST', '/api/admin/users/'.$pending->getId().'/resend-activation');

        self::assertResponseIsSuccessful();
        self::assertTrue($this->responseData()['emailSent']);
        self::assertEmailCount(1);
        $this->client->jsonRequest('POST', '/api/activation/check', ['token' => $previous]);
        self::assertResponseStatusCodeSame(410);
        $this->assertAudited(AdminAction::ActivationResent, 'pending@acme.test');
    }

    public function testAnActivatedAccountGetsNoNewLink(): void
    {
        $this->adminCall('POST', '/api/admin/users/'.$this->user->getId().'/resend-activation');

        $this->assertRefused('already_activated');
        self::assertEmailCount(0);
    }

    public function testListsTheTeam(): void
    {
        $this->adminGet('/api/admin/team');

        self::assertResponseIsSuccessful();
        self::assertSame([self::TEAM_EMAIL], array_column($this->responseList(), 'email'));
    }

    public function testInvitesATeamMemberWhoActivatesTheirAccountAndGetsIn(): void
    {
        $this->adminCall('POST', '/api/admin/team', [
            'email' => 'Nora@reglo.test',
            'firstName' => 'Nora',
            'lastName' => 'Petit',
        ]);

        self::assertResponseStatusCodeSame(201);
        $data = $this->responseData();
        self::assertSame('nora@reglo.test', $data['email']);
        self::assertNull($data['organization']);
        self::assertFalse($data['activated']);
        self::assertTrue($data['emailSent']);
        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        $this->assertAudited(AdminAction::TeamMemberInvited, 'nora@reglo.test');

        self::assertSame(1, preg_match('/token=([0-9a-f]+)/', (string) $email->getTextBody(), $matches));
        $this->client->jsonRequest('POST', '/api/activation', ['token' => $matches[1], 'password' => 'correct-horse-battery']);
        self::assertResponseStatusCodeSame(204);

        $nora = $this->findUser('nora@reglo.test');
        self::assertNotNull($nora);
        self::assertTrue($nora->isPlatformAdmin());
        $this->client->jsonRequest('POST', '/api/auth/login', ['email' => 'nora@reglo.test', 'password' => 'correct-horse-battery']);
        self::assertResponseIsSuccessful();
        $this->getAs('/api/admin/team', (string) $this->responseData()['token']);
        self::assertResponseIsSuccessful();
        // By last name: Dupont (ProfileTestCase), then Petit.
        self::assertSame([self::TEAM_EMAIL, 'nora@reglo.test'], array_column($this->responseList(), 'email'));
    }

    public function testRefusesATeamMemberWithATakenEmailOrMissingDetails(): void
    {
        $this->adminCall('POST', '/api/admin/team', ['email' => self::EMAIL, 'firstName' => 'A', 'lastName' => 'B']);
        $this->assertInvalidFields(['email']);

        $this->adminCall('POST', '/api/admin/team', ['email' => 'nora@reglo.test']);
        $this->assertInvalidFields(['firstName', 'lastName']);

        self::assertEmailCount(0);
    }

    public function testRemovesATeamMemberButNotOneself(): void
    {
        $colleague = $this->createUser('colleague@reglo.test', null)->setRoles([User::ROLE_PLATFORM_ADMIN]);
        $this->entityManager->flush();

        $this->adminCall('DELETE', '/api/admin/team/'.$this->teamMember->getId());
        $this->assertRefused('cannot_remove_self');
        self::assertNotNull($this->findUser(self::TEAM_EMAIL));

        $this->adminCall('DELETE', '/api/admin/team/'.$colleague->getId());
        self::assertResponseStatusCodeSame(204);
        self::assertNull($this->findUser('colleague@reglo.test'));
        $this->assertAudited(AdminAction::TeamMemberRemoved, 'colleague@reglo.test');
    }

    public function testAClientIsNotRemovedThroughTheTeamRoute(): void
    {
        $this->adminCall('DELETE', '/api/admin/team/'.$this->user->getId());

        self::assertResponseStatusCodeSame(404);
        self::assertNotNull($this->findUser(self::EMAIL));
    }

    private function makeAdmin(User $user): void
    {
        $user->setOrganizationRole(OrganizationRole::Admin);
        $this->entityManager->flush();
    }
}
