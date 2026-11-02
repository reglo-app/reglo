<?php

namespace App\Tests\Tenant;

use App\Entity\Organization;
use App\Entity\User;
use App\Security\AccessTokenManager;
use App\Tests\DatabaseResetTrait;
use App\Tests\Fixtures\Entity\IsolationProbe;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Two organizations, A and B, each with an administrator, and helpers to
 * call the API as one of them. Base class of the tenant isolation tests.
 */
abstract class TenantIsolationTestCase extends WebTestCase
{
    use DatabaseResetTrait;

    protected KernelBrowser $client;
    protected EntityManagerInterface $entityManager;
    protected Organization $organizationA;
    protected Organization $organizationB;
    protected User $userA;
    protected User $userB;

    /** @var array<string, string> plain access token by user e-mail */
    private array $tokens = [];

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        IsolationProbe::createTable($this->connection());
        self::resetDatabase($this->entityManager);

        $this->organizationA = new Organization('Organization A');
        $this->organizationB = new Organization('Organization B');
        $this->entityManager->persist($this->organizationA);
        $this->entityManager->persist($this->organizationB);
        $this->userA = $this->createUser('admin@a.test', $this->organizationA);
        $this->userB = $this->createUser('admin@b.test', $this->organizationB);
        $this->entityManager->flush();
    }

    /**
     * Activated administrator of the organization (null: platform
     * administrator), with an access token ready for requestAs().
     */
    protected function createUser(string $email, ?Organization $organization): User
    {
        $user = (new User($email))
            ->setRoles([null === $organization ? 'ROLE_PLATFORM_ADMIN' : 'ROLE_ADMIN'])
            ->setOrganization($organization)
            ->activate('not-a-real-hash');
        $this->entityManager->persist($user);
        // Issued now: the kernel, so the entity manager, changes between
        // requests.
        $this->tokens[$user->getEmail()] = static::getContainer()->get(AccessTokenManager::class)->issue($user);

        return $user;
    }

    /**
     * Calls the API as this user, in JSON-LD (the format of the API).
     *
     * @param array<string, mixed>|null $body
     *
     * @return array<mixed>|null decoded response, null when empty
     */
    protected function requestAs(User $user, string $method, string $uri, ?array $body = null): ?array
    {
        $this->client->request($method, $uri, server: [
            'HTTP_AUTHORIZATION' => 'Bearer '.$this->tokens[$user->getEmail()],
            'HTTP_ACCEPT' => 'application/ld+json',
            'CONTENT_TYPE' => 'PATCH' === $method ? 'application/merge-patch+json' : 'application/ld+json',
        ], content: null === $body ? null : json_encode($body, \JSON_THROW_ON_ERROR));

        $content = (string) $this->client->getResponse()->getContent();

        return '' === $content ? null : (array) json_decode($content, true, flags: \JSON_THROW_ON_ERROR);
    }

    /**
     * Items of a collection answered by requestAs().
     *
     * @param array<mixed>|null $response
     *
     * @return array<mixed>
     */
    protected static function members(?array $response): array
    {
        self::assertIsArray($response);
        self::assertArrayHasKey('member', $response);
        self::assertIsArray($response['member']);

        return $response['member'];
    }

    /**
     * Database checks go through plain SQL: after a request, the entity
     * manager keeps the organization filter of that request.
     */
    protected function connection(): Connection
    {
        return $this->entityManager->getConnection();
    }
}
