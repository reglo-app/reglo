<?php

namespace App\Tests\Tenant;

use App\Entity\Organization;
use App\Tenant\OrganizationOwnedInterface;
use App\Tests\Fixtures\Entity\IsolationProbe;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Rule 1: a user never reads nor writes the data of another organization.
 *
 * Every API resource owned by an organization MUST be listed in
 * organizationOwnedResources(): OrganizationOwnershipTest fails otherwise.
 */
final class TenantIsolationTest extends TenantIsolationTestCase
{
    /**
     * @return iterable<string, array{OrganizationOwnedResource}>
     */
    public static function organizationOwnedResources(): iterable
    {
        yield 'isolation probe (test only)' => [new OrganizationOwnedResource(
            class: IsolationProbe::class,
            uri: '/api/isolation_probes',
            create: static function (Organization $organization): IsolationProbe {
                $probe = new IsolationProbe();
                $probe->setOrganization($organization);
                $probe->setLabel('Existing');

                return $probe;
            },
            createPayload: ['label' => 'Created'],
            updatePayload: ['label' => 'Updated'],
        )];
    }

    #[DataProvider('organizationOwnedResources')]
    public function testListShowsOnlyTheOwnOrganization(OrganizationOwnedResource $resource): void
    {
        $ownId = $this->createIn($resource, $this->organizationA);
        $this->createIn($resource, $this->organizationB);

        $response = $this->requestAs($this->userA, 'GET', $resource->uri);

        self::assertResponseIsSuccessful();
        self::assertSame([$ownId], array_column(self::members($response), 'id'));
    }

    #[DataProvider('organizationOwnedResources')]
    public function testItemOfAnotherOrganizationIsNotFound(OrganizationOwnedResource $resource): void
    {
        $otherId = $this->createIn($resource, $this->organizationB);

        $this->requestAs($this->userA, 'GET', $resource->uri.'/'.$otherId);

        // 404, not 403: A must not even learn that the item exists.
        self::assertResponseStatusCodeSame(404);
    }

    #[DataProvider('organizationOwnedResources')]
    public function testItemOfAnotherOrganizationCannotBeUpdated(OrganizationOwnedResource $resource): void
    {
        $otherId = $this->createIn($resource, $this->organizationB);
        $before = $this->row($resource, $otherId);

        $this->requestAs($this->userA, 'PATCH', $resource->uri.'/'.$otherId, $resource->updatePayload);

        self::assertResponseStatusCodeSame(404);
        self::assertSame($before, $this->row($resource, $otherId));
    }

    #[DataProvider('organizationOwnedResources')]
    public function testItemOfAnotherOrganizationCannotBeDeleted(OrganizationOwnedResource $resource): void
    {
        $otherId = $this->createIn($resource, $this->organizationB);

        $this->requestAs($this->userA, 'DELETE', $resource->uri.'/'.$otherId);

        self::assertResponseStatusCodeSame(404);
        self::assertNotFalse($this->row($resource, $otherId));
    }

    #[DataProvider('organizationOwnedResources')]
    public function testCreationIgnoresAnOrganizationSentByTheClient(OrganizationOwnedResource $resource): void
    {
        $payload = $resource->createPayload + [
            'organization' => '/api/organizations/'.$this->organizationB->getId(),
            'organizationId' => $this->organizationB->getId(),
        ];

        $created = $this->requestAs($this->userA, 'POST', $resource->uri, $payload);

        self::assertResponseStatusCodeSame(201);
        self::assertIsArray($created);
        self::assertSame($this->organizationA->getId(), $this->row($resource, (int) $created['id'])['organization_id'] ?? null);
    }

    #[DataProvider('organizationOwnedResources')]
    public function testUpdateCannotMoveAnItemToAnotherOrganization(OrganizationOwnedResource $resource): void
    {
        $ownId = $this->createIn($resource, $this->organizationA);
        $payload = $resource->updatePayload + [
            'organization' => '/api/organizations/'.$this->organizationB->getId(),
        ];

        $this->requestAs($this->userA, 'PATCH', $resource->uri.'/'.$ownId, $payload);

        self::assertResponseIsSuccessful();
        self::assertSame($this->organizationA->getId(), $this->row($resource, $ownId)['organization_id'] ?? null);
    }

    #[DataProvider('organizationOwnedResources')]
    public function testUserWithoutOrganizationSeesNothing(OrganizationOwnedResource $resource): void
    {
        // Platform administrators (REGLO team) belong to no client.
        $platformAdmin = $this->createUser('team@reglo.test', null);
        $this->entityManager->flush();
        $id = $this->createIn($resource, $this->organizationA);

        self::assertSame([], self::members($this->requestAs($platformAdmin, 'GET', $resource->uri)));
        $this->requestAs($platformAdmin, 'GET', $resource->uri.'/'.$id);
        self::assertResponseStatusCodeSame(404);
    }

    #[DataProvider('organizationOwnedResources')]
    public function testAnonymousRequestIsRejected(OrganizationOwnedResource $resource): void
    {
        $this->client->request('GET', $resource->uri);

        self::assertResponseStatusCodeSame(401);
    }

    private function createIn(OrganizationOwnedResource $resource, Organization $organization): int
    {
        $entity = ($resource->create)($organization);
        $this->entityManager->persist($entity);
        $this->entityManager->flush();
        // As in a real request: loaded from the database, not from memory.
        $this->entityManager->detach($entity);

        return $this->idOf($entity);
    }

    private function idOf(OrganizationOwnedInterface $entity): int
    {
        $id = $this->entityManager->getClassMetadata($entity::class)->getIdentifierValues($entity);

        return (int) reset($id);
    }

    /**
     * @return array<string, mixed>|false
     */
    private function row(OrganizationOwnedResource $resource, int $id): array|false
    {
        $table = $this->entityManager->getClassMetadata($resource->class)->getTableName();

        return $this->connection()->fetchAssociative("SELECT * FROM $table WHERE id = ?", [$id]);
    }
}
