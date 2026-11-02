<?php

namespace App\Tests\Tenant;

use App\Entity\Organization;
use App\Entity\User;
use App\Tests\DatabaseResetTrait;
use App\Tests\Fixtures\Entity\IsolationProbe;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;

/**
 * Write side of the isolation, whatever the API exposes: even code that sets
 * another organization cannot write into it.
 */
final class OrganizationAssignmentListenerTest extends KernelTestCase
{
    use DatabaseResetTrait;

    private EntityManagerInterface $entityManager;
    private Organization $organizationA;
    private Organization $organizationB;

    protected function setUp(): void
    {
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        IsolationProbe::createTable($this->entityManager->getConnection());
        self::resetDatabase($this->entityManager);

        $this->organizationA = new Organization('Organization A');
        $this->organizationB = new Organization('Organization B');
        $this->entityManager->persist($this->organizationA);
        $this->entityManager->persist($this->organizationB);
        $this->entityManager->flush();
    }

    public function testNewEntityGetsTheOrganizationOfTheLoggedInUser(): void
    {
        $this->logInto($this->organizationA);

        $probe = $this->saveProbeIn($this->organizationB);

        self::assertSame($this->organizationA->getId(), $this->storedOrganizationId($probe));
    }

    public function testWithoutLoggedInUserTheGivenOrganizationIsKept(): void
    {
        // Console commands (e.g. app:create-organization) choose it.
        $probe = $this->saveProbeIn($this->organizationB);

        self::assertSame($this->organizationB->getId(), $this->storedOrganizationId($probe));
    }

    public function testAnEntityNeverMovesToAnotherOrganization(): void
    {
        $probe = $this->saveProbeIn($this->organizationA);

        $probe->setOrganization($this->organizationB);
        $probe->setLabel('Updated');
        $this->entityManager->flush();

        self::assertSame($this->organizationA->getId(), $this->storedOrganizationId($probe));
        self::assertSame('Updated', $this->entityManager->getConnection()->fetchOne('SELECT label FROM isolation_probe WHERE id = ?', [$probe->getId()]));
    }

    private function logInto(Organization $organization): void
    {
        $user = (new User('admin@'.$organization->getId().'.test'))->setOrganization($organization);
        static::getContainer()->get(TokenStorageInterface::class)->setToken(
            new UsernamePasswordToken($user, 'main', $user->getRoles()),
        );
    }

    private function saveProbeIn(Organization $organization): IsolationProbe
    {
        $probe = new IsolationProbe();
        $probe->setOrganization($organization);
        $probe->setLabel('Probe');
        $this->entityManager->persist($probe);
        $this->entityManager->flush();

        return $probe;
    }

    private function storedOrganizationId(IsolationProbe $probe): mixed
    {
        return $this->entityManager->getConnection()->fetchOne('SELECT organization_id FROM isolation_probe WHERE id = ?', [$probe->getId()]);
    }
}
