<?php

namespace App\Tests\Command;

use App\Entity\ActivationToken;
use App\Entity\Organization;
use App\Entity\User;
use App\Repository\OrganizationRepository;
use App\Repository\UserRepository;
use App\Tests\DatabaseResetTrait;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Mime\Email;

final class CreateOrganizationCommandTest extends KernelTestCase
{
    use DatabaseResetTrait;

    private CommandTester $tester;
    private EntityManagerInterface $entityManager;
    private UserRepository $userRepository;
    private OrganizationRepository $organizationRepository;

    protected function setUp(): void
    {
        $kernel = self::bootKernel();
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        self::resetDatabase($this->entityManager);

        $this->tester = new CommandTester((new Application($kernel))->find('app:create-organization'));
        $this->userRepository = static::getContainer()->get(UserRepository::class);
        $this->organizationRepository = static::getContainer()->get(OrganizationRepository::class);
    }

    public function testCreatesTheOrganizationAndItsAdministrator(): void
    {
        $status = $this->create('  Acme   SAS ', 'Claire.Dupont@Acme.test', ' Claire ', 'Dupont');

        self::assertSame(Command::SUCCESS, $status);
        $organization = $this->organizationRepository->findOneBy(['name' => 'Acme SAS']);
        self::assertInstanceOf(Organization::class, $organization);

        $admin = $this->userRepository->findOneByEmail('claire.dupont@acme.test');
        self::assertInstanceOf(User::class, $admin);
        self::assertSame($organization->getId(), $admin->getOrganization()?->getId());
        self::assertSame('Claire', $admin->getFirstName());
        self::assertSame('Dupont', $admin->getLastName());
        self::assertContains('ROLE_ADMIN', $admin->getRoles());
        self::assertFalse($admin->isActivated());
        self::assertSame('', $admin->getPassword());
    }

    public function testSendsTheActivationEmail(): void
    {
        $this->create('Acme', 'claire.dupont@acme.test', 'Claire', 'Dupont');

        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertEmailAddressContains($email, 'To', 'claire.dupont@acme.test');
        self::assertEmailHeaderSame($email, 'Subject', 'Activez votre compte Réglo');
        self::assertEmailTextBodyContains($email, 'Bonjour Claire');
        self::assertEmailHtmlBodyContains($email, 'Acme');
        self::assertMatchesRegularExpression('#http://localhost:3000/activation\?token=[0-9a-f]{64}#', (string) $email->getTextBody());
    }

    public function testStoresOnlyTheHashOfTheActivationToken(): void
    {
        $this->create('Acme', 'claire.dupont@acme.test', 'Claire', 'Dupont');

        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        preg_match('/token=([0-9a-f]{64})/', (string) $email->getTextBody(), $matches);
        $repository = $this->entityManager->getRepository(ActivationToken::class);

        self::assertNull($repository->findOneBy(['tokenHash' => $matches[1]]));
        $token = $repository->findOneBy(['tokenHash' => hash('sha256', $matches[1])]);
        self::assertInstanceOf(ActivationToken::class, $token);
        self::assertEqualsWithDelta((new \DateTimeImmutable('+48 hours'))->getTimestamp(), $token->getExpiresAt()->getTimestamp(), 5);
    }

    public function testRejectsAnExistingNameWhateverTheCase(): void
    {
        $this->create('Acme SAS', 'claire.dupont@acme.test', 'Claire', 'Dupont');

        $status = $this->create('ACME  sas', 'other@acme.test', 'Paul', 'Durand');

        self::assertSame(Command::FAILURE, $status);
        self::assertStringContainsString('already exists', $this->tester->getDisplay());
        self::assertCount(1, $this->organizationRepository->findAll());
        self::assertNull($this->userRepository->findOneByEmail('other@acme.test'));
    }

    public function testRejectsAnEmailAlreadyUsed(): void
    {
        $this->create('Acme', 'claire.dupont@acme.test', 'Claire', 'Dupont');

        $status = $this->create('Other company', 'CLAIRE.DUPONT@acme.test', 'Claire', 'Dupont');

        self::assertSame(Command::FAILURE, $status);
        self::assertStringContainsString('A user with this e-mail already exists', $this->tester->getDisplay());
        self::assertNull($this->organizationRepository->findOneBy(['name' => 'Other company']));
    }

    public function testRejectsInvalidInput(): void
    {
        $status = $this->create(' ', 'not-an-email', ' ', 'Dupont');

        self::assertSame(Command::FAILURE, $status);
        $display = $this->tester->getDisplay();
        self::assertStringContainsString('organization name', $display);
        self::assertStringContainsString('e-mail is not valid', $display);
        self::assertStringContainsString('first name', $display);
        self::assertCount(0, $this->organizationRepository->findAll());
        self::assertEmailCount(0);
    }

    private function create(string $name, string $email, string $firstName, string $lastName): int
    {
        return $this->tester->execute([
            'name' => $name,
            'admin-email' => $email,
            'admin-first-name' => $firstName,
            'admin-last-name' => $lastName,
        ]);
    }
}
