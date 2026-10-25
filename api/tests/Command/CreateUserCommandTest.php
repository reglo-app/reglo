<?php

namespace App\Tests\Command;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Tests\DatabaseResetTrait;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class CreateUserCommandTest extends KernelTestCase
{
    use DatabaseResetTrait;

    private const PASSWORD = 'correct-horse-battery';

    private CommandTester $tester;
    private UserRepository $userRepository;

    protected function setUp(): void
    {
        $kernel = self::bootKernel();
        self::resetDatabase(static::getContainer()->get(EntityManagerInterface::class));

        $this->tester = new CommandTester((new Application($kernel))->find('app:user:create'));
        $this->userRepository = static::getContainer()->get(UserRepository::class);
    }

    public function testCreatesAUserWithAHashedPassword(): void
    {
        $this->tester->setInputs([self::PASSWORD, self::PASSWORD]);

        $status = $this->tester->execute(['email' => 'Jeanne.Martin@Example.com']);

        self::assertSame(Command::SUCCESS, $status);
        $user = $this->userRepository->findOneByEmail('jeanne.martin@example.com');
        self::assertInstanceOf(User::class, $user);
        self::assertSame('jeanne.martin@example.com', $user->getEmail());
        self::assertNotSame(self::PASSWORD, $user->getPassword());
        self::assertTrue(static::getContainer()->get(UserPasswordHasherInterface::class)->isPasswordValid($user, self::PASSWORD));
    }

    public function testRejectsAShortPassword(): void
    {
        $this->tester->setInputs(['short-pass1']);

        $status = $this->tester->execute(['email' => 'jeanne.martin@example.com']);

        self::assertSame(Command::FAILURE, $status);
        self::assertStringContainsString('at least 12 characters', $this->tester->getDisplay());
        self::assertNull($this->userRepository->findOneByEmail('jeanne.martin@example.com'));
    }

    public function testRejectsADifferentConfirmation(): void
    {
        $this->tester->setInputs([self::PASSWORD, 'another-password']);

        $status = $this->tester->execute(['email' => 'jeanne.martin@example.com']);

        self::assertSame(Command::FAILURE, $status);
        self::assertNull($this->userRepository->findOneByEmail('jeanne.martin@example.com'));
    }

    public function testRejectsAnInvalidEmail(): void
    {
        $status = $this->tester->execute(['email' => 'not-an-email']);

        self::assertSame(Command::FAILURE, $status);
        self::assertStringContainsString('not valid', $this->tester->getDisplay());
    }

    public function testRejectsAnExistingEmail(): void
    {
        $this->tester->setInputs([self::PASSWORD, self::PASSWORD]);
        $this->tester->execute(['email' => 'jeanne.martin@example.com']);

        $status = $this->tester->execute(['email' => 'JEANNE.MARTIN@example.com']);

        self::assertSame(Command::FAILURE, $status);
        self::assertStringContainsString('already exists', $this->tester->getDisplay());
    }
}
