<?php

namespace App\Tests\Controller\Admin;

use App\Entity\AdminAction;
use App\Entity\AdminAuditEntry;
use App\Entity\User;
use App\Tests\Controller\ProfileTestCase;

/**
 * A member of the REGLO team, logged in, next to the organization "Acme" of
 * ProfileTestCase.
 */
abstract class AdminTestCase extends ProfileTestCase
{
    protected const TEAM_EMAIL = 'team@reglo.test';

    protected User $teamMember;
    protected string $teamToken;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teamMember = $this->createUser(self::TEAM_EMAIL, null)->setRoles([User::ROLE_PLATFORM_ADMIN]);
        $this->entityManager->flush();
        $this->teamToken = $this->issueToken($this->teamMember);
    }

    /**
     * @param array<string, mixed> $body
     */
    protected function adminCall(string $method, string $uri, array $body = []): void
    {
        $this->jsonAs($method, $uri, $body, $this->teamToken);
    }

    protected function adminGet(string $uri): void
    {
        $this->getAs($uri, $this->teamToken);
    }

    protected function assertRefused(string $code): void
    {
        self::assertResponseStatusCodeSame(422);
        self::assertSame($code, $this->responseData()['code']);
    }

    /**
     * @param list<string> $fields
     */
    protected function assertInvalidFields(array $fields): void
    {
        $this->assertRefused('invalid_input');
        $data = $this->responseData();
        self::assertIsArray($data['fields']);
        self::assertSame($fields, array_keys($data['fields']));
        self::assertIsString($data['error']);
    }

    protected function assertAudited(AdminAction $action, string $target): void
    {
        $this->entityManager->clear();
        $entries = $this->entityManager->getRepository(AdminAuditEntry::class)->findBy(['action' => $action]);

        self::assertCount(1, $entries);
        self::assertSame(self::TEAM_EMAIL, $entries[0]->getActorEmail());
        self::assertSame($target, $entries[0]->getTarget());
    }

    protected function assertNothingAudited(): void
    {
        $this->entityManager->clear();

        self::assertSame([], $this->entityManager->getRepository(AdminAuditEntry::class)->findAll());
    }

    protected function findUser(string $email): ?User
    {
        $this->entityManager->clear();

        return $this->entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
    }
}
