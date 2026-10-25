<?php

namespace App\Command;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Temporary way to create accounts until organization onboarding (US-01)
 * exists. The password is asked interactively so it never appears in the
 * shell history.
 */
#[AsCommand(name: 'app:user:create', description: 'Create a user account')]
final class CreateUserCommand extends Command
{
    public const MIN_PASSWORD_LENGTH = 12;

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly UserRepository $userRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly ValidatorInterface $validator,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('email', InputArgument::REQUIRED, 'E-mail of the user');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $email = User::normalizeEmail((string) $input->getArgument('email'));

        if (\count($this->validator->validate($email, [new Assert\NotBlank(), new Assert\Email()])) > 0) {
            $io->error('The e-mail is not valid.');

            return Command::FAILURE;
        }

        if (null !== $this->userRepository->findOneByEmail($email)) {
            $io->error('A user with this e-mail already exists.');

            return Command::FAILURE;
        }

        $password = (string) $io->askHidden('Password ('.self::MIN_PASSWORD_LENGTH.' characters minimum)');

        if (mb_strlen($password) < self::MIN_PASSWORD_LENGTH) {
            $io->error(\sprintf('The password must contain at least %d characters.', self::MIN_PASSWORD_LENGTH));

            return Command::FAILURE;
        }

        if ($password !== (string) $io->askHidden('Confirm the password')) {
            $io->error('The passwords do not match.');

            return Command::FAILURE;
        }

        $user = new User($email);
        $user->setPassword($this->passwordHasher->hashPassword($user, $password));

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        $io->success(\sprintf('User %s created.', $email));

        return Command::SUCCESS;
    }
}
