<?php

namespace App\Tests\Controller;

use App\Entity\Organization;
use App\Entity\User;

/**
 * GET /api/users: the members of the own organization only (rule 1).
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
}
