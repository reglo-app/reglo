<?php

namespace App\Tests\Controller;

use App\Controller\MemberController;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Entity\User;
use App\Storage\AvatarStorage;

/**
 * /api/users: the members of the own organization only (rule 1); an
 * administrator changes their role or removes them (US-16).
 */
final class MemberControllerTest extends ProfileTestCase
{
    public function testListsTheMembersOfTheOwnOrganizationByName(): void
    {
        $this->createUser('zoe@acme.test', $this->organization)->setName('Zoé', 'Bernard')->setRoles(['ROLE_READER']);
        // Invited by the onboarding command, not activated yet
        $pending = (new User('admin@acme.test'))->setName('Alain', 'Durand')->setOrganization($this->organization)->setRoles(['ROLE_ADMIN']);
        $this->entityManager->persist($pending);
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $this->createUser('spy@globex.test', $globex);
        $this->entityManager->flush();

        $this->getAs('/api/users');

        self::assertResponseIsSuccessful();
        $members = $this->responseList();
        self::assertSame(['zoe@acme.test', 'claire.dupont@acme.test', 'admin@acme.test'], array_column($members, 'email'));
        self::assertSame(['reader', 'member', 'admin'], array_column($members, 'role'));
        self::assertSame([true, true, false], array_column($members, 'activated'));
        self::assertSame(
            ['id', 'email', 'firstName', 'lastName', 'jobTitle', 'avatarVersion', 'role', 'activated'],
            array_keys($members[0]),
        );
    }

    public function testAReaderCanListTheMembers(): void
    {
        $reader = $this->createUser('lea@acme.test', $this->organization)->setRoles(['ROLE_READER']);
        $this->entityManager->flush();

        $this->getAs('/api/users', $this->issueToken($reader));

        self::assertResponseIsSuccessful();
        self::assertCount(2, $this->responseData());
    }

    public function testAPlatformAdministratorSeesNoMember(): void
    {
        $platformAdmin = $this->createUser('team@reglo.test', null);

        $this->getAs('/api/users', $this->issueToken($platformAdmin));

        self::assertResponseIsSuccessful();
        self::assertSame([], $this->responseData());
    }

    public function testAnonymousRequestIsRejected(): void
    {
        $this->client->request('GET', '/api/users');

        self::assertResponseStatusCodeSame(401);
    }

    public function testAnAdministratorChangesTheRoleOfAMember(): void
    {
        $this->makeAdmin();
        $paul = $this->createUser('paul@acme.test', $this->organization);
        $paulToken = $this->issueToken($paul);

        $this->jsonAs('PATCH', '/api/users/'.$paul->getId(), ['role' => 'reader']);

        self::assertResponseIsSuccessful();
        self::assertSame('reader', $this->responseData()['role']);
        $this->getAs('/api/auth/me', $paulToken);
        self::assertSame('reader', $this->responseData()['role']);
    }

    public function testAnInvalidRoleIsRefused(): void
    {
        $this->makeAdmin();
        $paul = $this->createUser('paul@acme.test', $this->organization);

        $this->jsonAs('PATCH', '/api/users/'.$paul->getId(), ['role' => 'ROLE_PLATFORM_ADMIN']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('invalid_role', $this->responseData()['code']);
        self::assertSame(OrganizationRole::Member, $this->reload($paul)->getOrganizationRole());
    }

    public function testTheLastAdministratorCannotStepDown(): void
    {
        $this->makeAdmin();

        $this->jsonAs('PATCH', '/api/users/'.$this->user->getId(), ['role' => 'member']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['error' => MemberController::LAST_ADMIN, 'code' => 'last_admin'], $this->responseData());
        self::assertSame(OrganizationRole::Admin, $this->reload($this->user)->getOrganizationRole());
    }

    public function testAnAdministratorStepsDownOnceAnotherIsNamed(): void
    {
        $this->makeAdmin();
        $paul = $this->createUser('paul@acme.test', $this->organization);
        $this->jsonAs('PATCH', '/api/users/'.$paul->getId(), ['role' => 'admin']);
        self::assertResponseIsSuccessful();

        $this->jsonAs('PATCH', '/api/users/'.$this->user->getId(), ['role' => 'member']);

        self::assertResponseIsSuccessful();
        self::assertSame('member', $this->responseData()['role']);
    }

    public function testOnlyAnAdministratorChangesRoles(): void
    {
        $paul = $this->createUser('paul@acme.test', $this->organization);

        $this->jsonAs('PATCH', '/api/users/'.$paul->getId(), ['role' => 'admin']);
        self::assertResponseStatusCodeSame(403);
        $this->jsonAs('PATCH', '/api/users/'.$this->user->getId(), ['role' => 'admin']);
        self::assertResponseStatusCodeSame(403);

        self::assertSame(OrganizationRole::Member, $this->reload($this->user)->getOrganizationRole());
    }

    public function testAMemberOfAnotherOrganizationCannotBeChangedNorRemoved(): void
    {
        $this->makeAdmin();
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $spy = $this->createUser('spy@globex.test', $globex);

        $this->jsonAs('PATCH', '/api/users/'.$spy->getId(), ['role' => 'reader']);
        self::assertResponseStatusCodeSame(404);
        $this->jsonAs('DELETE', '/api/users/'.$spy->getId());
        self::assertResponseStatusCodeSame(404);

        self::assertSame(OrganizationRole::Member, $this->reload($spy)->getOrganizationRole());
    }

    public function testAnAdministratorRemovesAMember(): void
    {
        $this->makeAdmin();
        $paul = $this->createUser('paul@acme.test', $this->organization);
        $paulToken = $this->issueToken($paul);
        // A profile photo on disk: removed with the account
        $storage = static::getContainer()->get(AvatarStorage::class);
        $photo = str_repeat('a', 32).'.webp';
        if (!is_dir(\dirname($storage->path($photo)))) {
            mkdir(\dirname($storage->path($photo)), recursive: true);
        }
        file_put_contents($storage->path($photo), 'photo');
        $paul->setAvatarFile($photo);
        $this->entityManager->flush();

        $this->jsonAs('DELETE', '/api/users/'.$paul->getId());

        self::assertResponseStatusCodeSame(204);
        self::assertFalse($this->entityManager->getConnection()->fetchOne('SELECT id FROM app_user WHERE email = ?', ['paul@acme.test']));
        self::assertFileDoesNotExist($storage->path($photo));
        self::assertFalse($this->isTokenValid($paulToken));
    }

    public function testAnAdministratorCannotRemoveThemself(): void
    {
        $this->makeAdmin();

        $this->jsonAs('DELETE', '/api/users/'.$this->user->getId());

        self::assertResponseStatusCodeSame(422);
        self::assertSame('cannot_remove_self', $this->responseData()['code']);
    }

    public function testOnlyAnAdministratorRemovesMembers(): void
    {
        $paul = $this->createUser('paul@acme.test', $this->organization);

        $this->jsonAs('DELETE', '/api/users/'.$paul->getId());

        self::assertResponseStatusCodeSame(403);
        self::assertSame(OrganizationRole::Member, $this->reload($paul)->getOrganizationRole());
    }

    private function makeAdmin(): void
    {
        $this->user->setOrganizationRole(OrganizationRole::Admin);
        $this->entityManager->flush();
    }

    /**
     * The user as stored now (the request used another entity manager).
     */
    private function reload(User $user): User
    {
        $this->entityManager->clear();
        $fresh = $this->entityManager->find(User::class, $user->getId());
        self::assertInstanceOf(User::class, $fresh);

        return $fresh;
    }
}
