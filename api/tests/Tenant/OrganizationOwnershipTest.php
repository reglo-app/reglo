<?php

namespace App\Tests\Tenant;

use ApiPlatform\Metadata\Resource\Factory\ResourceNameCollectionFactoryInterface;
use App\Entity\Organization;
use App\Entity\User;
use App\Tenant\OrganizationOwnedInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Fails as soon as data linked to an organization escapes the isolation:
 * an entity not filtered, or an API resource without isolation tests.
 */
final class OrganizationOwnershipTest extends KernelTestCase
{
    /**
     * Entities linked to an organization but deliberately not filtered,
     * with the reason. Keep this list as short as possible.
     */
    private const NOT_FILTERED = [
        // Loaded to log in, before any organization is known. Never expose
        // it as an API resource as is (the last test below checks it).
        User::class => 'authentication',
    ];

    public function testEveryEntityLinkedToAnOrganizationIsFiltered(): void
    {
        foreach ($this->allMetadata() as $metadata) {
            if (!$this->isLinkedToAnOrganization($metadata) || isset(self::NOT_FILTERED[$metadata->getName()])) {
                continue;
            }

            self::assertTrue(
                is_a($metadata->getName(), OrganizationOwnedInterface::class, true),
                \sprintf('%s is linked to an organization: implement %s (use OrganizationOwnedTrait) or add it to NOT_FILTERED with a reason.', $metadata->getName(), OrganizationOwnedInterface::class),
            );
        }
    }

    public function testOrganizationOwnedEntitiesUseTheFilteredMapping(): void
    {
        foreach ($this->allMetadata() as $metadata) {
            if (!is_a($metadata->getName(), OrganizationOwnedInterface::class, true)) {
                continue;
            }

            $message = \sprintf('%s: use OrganizationOwnedTrait, OrganizationFilter needs a non-nullable "organization" relation.', $metadata->getName());
            self::assertTrue($metadata->hasAssociation('organization'), $message);
            self::assertSame(Organization::class, $metadata->getAssociationTargetClass('organization'), $message);
            self::assertFalse($metadata->getAssociationMapping('organization')->joinColumns[0]->nullable ?? true, $message);
        }
    }

    public function testEveryApiResourceLinkedToAnOrganizationHasIsolationTests(): void
    {
        $tested = [];
        foreach (TenantIsolationTest::organizationOwnedResources() as [$resource]) {
            $tested[] = $resource->class;
        }

        $resources = static::getContainer()->get(ResourceNameCollectionFactoryInterface::class)->create();
        $entityManager = static::getContainer()->get(EntityManagerInterface::class);

        foreach ($resources as $class) {
            if ($entityManager->getMetadataFactory()->isTransient($class)) {
                continue;
            }

            $metadata = $entityManager->getClassMetadata($class);
            if (!$this->isLinkedToAnOrganization($metadata) && !is_a($class, OrganizationOwnedInterface::class, true)) {
                continue;
            }

            self::assertContains(
                $class,
                $tested,
                \sprintf('%s is an API resource linked to an organization: add it to TenantIsolationTest::organizationOwnedResources().', $class),
            );
        }
    }

    /**
     * @return list<ClassMetadata<object>>
     */
    private function allMetadata(): array
    {
        $metadata = static::getContainer()->get(EntityManagerInterface::class)->getMetadataFactory()->getAllMetadata();
        self::assertNotEmpty($metadata);

        return $metadata;
    }

    /**
     * @param ClassMetadata<object> $metadata
     */
    private function isLinkedToAnOrganization(ClassMetadata $metadata): bool
    {
        foreach ($metadata->getAssociationMappings() as $association) {
            if (Organization::class === $association->targetEntity && $association->isToOneOwningSide()) {
                return true;
            }
        }

        return false;
    }
}
