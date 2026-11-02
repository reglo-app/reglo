<?php

namespace App\Tests\Controller;

use App\Entity\Organization;
use App\Entity\User;
use App\Security\AccessTokenManager;
use App\Tests\DatabaseResetTrait;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * An activated user of an organization, logged in, for the "Mon profil"
 * tests.
 */
abstract class ProfileTestCase extends WebTestCase
{
    use DatabaseResetTrait;

    protected const EMAIL = 'claire.dupont@acme.test';
    protected const PASSWORD = 'correct-horse-battery';

    protected KernelBrowser $client;
    protected EntityManagerInterface $entityManager;
    protected Organization $organization;
    protected User $user;
    protected string $token;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        self::resetDatabase($this->entityManager);

        $this->organization = new Organization('Acme');
        $this->entityManager->persist($this->organization);
        $this->user = $this->createUser(self::EMAIL, $this->organization);
        $this->token = $this->issueToken($this->user);
    }

    protected function createUser(string $email, ?Organization $organization): User
    {
        $user = (new User($email))->setOrganization($organization)->setName('Claire', 'Dupont');
        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);
        $user->activate($hasher->hashPassword($user, self::PASSWORD));
        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return $user;
    }

    protected function issueToken(User $user): string
    {
        return static::getContainer()->get(AccessTokenManager::class)->issue($user);
    }

    /**
     * @param array<string, mixed> $body
     */
    protected function jsonAs(string $method, string $uri, array $body = [], ?string $token = null): void
    {
        $this->client->jsonRequest($method, $uri, $body, ['HTTP_AUTHORIZATION' => 'Bearer '.($token ?? $this->token)]);
    }

    protected function getAs(string $uri, ?string $token = null): void
    {
        $this->client->request('GET', $uri, server: ['HTTP_AUTHORIZATION' => 'Bearer '.($token ?? $this->token)]);
    }

    protected function isTokenValid(string $token): bool
    {
        $this->getAs('/api/auth/me', $token);

        return 200 === $this->client->getResponse()->getStatusCode();
    }

    /**
     * Database checks in plain SQL: the entity manager may hold stale data.
     */
    protected function userColumn(string $column): mixed
    {
        return $this->entityManager->getConnection()->fetchOne(
            \sprintf('SELECT %s FROM app_user WHERE id = ?', $column),
            [$this->user->getId()],
        );
    }

    /**
     * @return array<string, mixed>
     */
    protected function responseData(): array
    {
        $data = json_decode((string) $this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertIsArray($data);

        return $data;
    }
}
