<?php

namespace App\Tests\Tenant;

use App\Entity\OrganizationRole;
use App\Tests\Fixtures\Entity\IsolationProbe;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * US-16, rule 2: rights are enforced by the API. A reader only consults;
 * a member writes the data of the organization; only an administrator
 * manages the team. Checked on the test-only resource IsolationProbe, which
 * has no rule of its own: the central rule of security.yaml covers every
 * resource, current or future.
 */
final class RolePermissionTest extends TenantIsolationTestCase
{
    /**
     * @return iterable<string, array{OrganizationRole, string, string, int}>
     */
    public static function matrix(): iterable
    {
        $operations = [
            'list' => ['GET', '/api/isolation_probes'],
            'read' => ['GET', '/api/isolation_probes/{probe}'],
            'create' => ['POST', '/api/isolation_probes'],
            'update' => ['PATCH', '/api/isolation_probes/{probe}'],
            'delete' => ['DELETE', '/api/isolation_probes/{probe}'],
            'list members' => ['GET', '/api/users'],
            'change a role' => ['PATCH', '/api/users/{colleague}'],
            'list invitations' => ['GET', '/api/invitations'],
            'invite' => ['POST', '/api/invitations'],
            'own profile' => ['PATCH', '/api/me'],
        ];
        $expected = [
            //                    reader member admin
            'list' => [200, 200, 200],
            'read' => [200, 200, 200],
            'create' => [403, 201, 201],
            'update' => [403, 200, 200],
            'delete' => [403, 204, 204],
            'list members' => [200, 200, 200],
            'change a role' => [403, 403, 200],
            'list invitations' => [403, 403, 200],
            'invite' => [403, 403, 201],
            'own profile' => [200, 200, 200],
        ];

        foreach ($operations as $name => [$method, $uri]) {
            foreach ([OrganizationRole::Reader, OrganizationRole::Member, OrganizationRole::Admin] as $index => $role) {
                yield \sprintf('%s: %s', $role->value, $name) => [$role, $method, $uri, $expected[$name][$index]];
            }
        }
    }

    #[DataProvider('matrix')]
    public function testRights(OrganizationRole $role, string $method, string $uri, int $status): void
    {
        $user = $this->createUser(\sprintf('%s.tested@a.test', $role->value), $this->organizationA);
        $user->setOrganizationRole($role)->setName('Léa', 'Martin');
        $colleague = $this->createUser('colleague@a.test', $this->organizationA)->setOrganizationRole(OrganizationRole::Member);
        $probe = new IsolationProbe();
        $probe->setOrganization($this->organizationA);
        $probe->setLabel('Existing');
        $this->entityManager->persist($probe);
        $this->entityManager->flush();

        $this->requestAs($user, $method, strtr($uri, [
            '{probe}' => (string) $probe->getId(),
            '{colleague}' => (string) $colleague->getId(),
        ]), self::bodyFor($method, $uri));

        self::assertResponseStatusCodeSame($status);
    }

    public function testARoleChangeAppliesAtTheNextRequest(): void
    {
        $member = $this->createUser('member@a.test', $this->organizationA)->setOrganizationRole(OrganizationRole::Member);
        $this->entityManager->flush();
        $this->requestAs($member, 'POST', '/api/isolation_probes', ['label' => 'Before']);
        self::assertResponseStatusCodeSame(201);

        $this->requestAs($this->userA, 'PATCH', '/api/users/'.$member->getId(), ['role' => 'reader']);
        self::assertResponseIsSuccessful();

        $this->requestAs($member, 'POST', '/api/isolation_probes', ['label' => 'After']);
        self::assertResponseStatusCodeSame(403);
    }

    public function testAPlatformAdministratorCannotWriteOrganizationData(): void
    {
        $platformAdmin = $this->createUser('team@reglo.test', null);
        $this->entityManager->flush();

        $this->requestAs($platformAdmin, 'POST', '/api/isolation_probes', ['label' => 'Created']);

        self::assertResponseStatusCodeSame(403);
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function bodyFor(string $method, string $uri): ?array
    {
        return match (true) {
            'GET' === $method, 'DELETE' === $method => null,
            '/api/me' === $uri => ['firstName' => 'Léa', 'lastName' => 'Martin', 'jobTitle' => ''],
            str_starts_with($uri, '/api/users') => ['role' => 'reader'],
            '/api/invitations' === $uri => ['email' => 'new@a.test', 'firstName' => 'Nina', 'lastName' => 'Roux'],
            default => ['label' => 'Changed'],
        };
    }
}
