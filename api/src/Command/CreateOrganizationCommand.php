<?php

namespace App\Command;

use App\Entity\Organization;
use App\Entity\User;
use App\Mailer\ActivationMailer;
use App\Repository\OrganizationRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Onboards a client (US-01): creates the organization and its first
 * administrator, who receives an e-mail to choose a password. Only people
 * with access to the server (REGLO platform administrators) can run it.
 */
#[AsCommand(name: 'app:create-organization', description: 'Create an organization and invite its first administrator')]
final class CreateOrganizationCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly OrganizationRepository $organizationRepository,
        private readonly UserRepository $userRepository,
        private readonly ActivationMailer $activationMailer,
        private readonly ValidatorInterface $validator,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('name', InputArgument::REQUIRED, 'Name of the organization')
            ->addArgument('admin-email', InputArgument::REQUIRED, 'E-mail of the first administrator')
            ->addArgument('admin-first-name', InputArgument::REQUIRED, 'First name of the first administrator')
            ->addArgument('admin-last-name', InputArgument::REQUIRED, 'Last name of the first administrator');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $name = Organization::normalizeName((string) $input->getArgument('name'));
        $email = User::normalizeEmail((string) $input->getArgument('admin-email'));
        $firstName = trim((string) $input->getArgument('admin-first-name'));
        $lastName = trim((string) $input->getArgument('admin-last-name'));

        $errors = $this->validate($name, $email, $firstName, $lastName);

        if ([] !== $errors) {
            $io->error($errors);

            return Command::FAILURE;
        }

        $organization = new Organization($name);
        $admin = (new User($email))
            ->setName($firstName, $lastName)
            ->setOrganization($organization)
            ->setRoles(['ROLE_ADMIN']);

        $this->entityManager->persist($organization);
        $this->entityManager->persist($admin);
        $this->entityManager->flush();

        try {
            $this->activationMailer->send($admin);
        } catch (TransportExceptionInterface $exception) {
            $io->warning(\sprintf(
                'Organization created, but the activation e-mail could not be sent (%s). The administrator can ask for a new link from the activation page.',
                $exception->getMessage(),
            ));

            return Command::SUCCESS;
        }

        $io->success(\sprintf('Organization "%s" created. Activation e-mail sent to %s.', $name, $email));

        return Command::SUCCESS;
    }

    /**
     * @return list<string>
     */
    private function validate(string $name, string $email, string $firstName, string $lastName): array
    {
        $errors = [];

        if ('' === $name || mb_strlen($name) > Organization::MAX_NAME_LENGTH) {
            $errors[] = \sprintf('The organization name must contain 1 to %d characters.', Organization::MAX_NAME_LENGTH);
        } elseif ($this->organizationRepository->existsWithName($name)) {
            $errors[] = 'An organization with this name already exists.';
        }

        if (\count($this->validator->validate($email, [new Assert\NotBlank(), new Assert\Email()])) > 0) {
            $errors[] = 'The e-mail is not valid.';
        } elseif (null !== $this->userRepository->findOneByEmail($email)) {
            $errors[] = 'A user with this e-mail already exists.';
        }

        foreach (['first name' => $firstName, 'last name' => $lastName] as $label => $value) {
            if ('' === $value || mb_strlen($value) > User::MAX_NAME_LENGTH) {
                $errors[] = \sprintf('The %s must contain 1 to %d characters.', $label, User::MAX_NAME_LENGTH);
            }
        }

        return $errors;
    }
}
