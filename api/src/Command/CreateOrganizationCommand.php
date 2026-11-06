<?php

namespace App\Command;

use App\Entity\Organization;
use App\Entity\User;
use App\Mailer\ActivationMailer;
use App\Platform\AccountProvisioner;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

/**
 * Onboards a client (US-01): creates the organization and its first
 * administrator, who receives an e-mail to choose a password. Only people
 * with access to the server (REGLO platform administrators) can run it.
 */
#[AsCommand(name: 'app:create-organization', description: 'Create an organization and invite its first administrator')]
final class CreateOrganizationCommand extends Command
{
    public function __construct(
        private readonly AccountProvisioner $provisioner,
        private readonly ActivationMailer $activationMailer,
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

        $admin = $this->provisioner->createOrganization($name, $email, $firstName, $lastName);

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
        $nameError = $this->provisioner->nameError($name);
        $codes = [...(null === $nameError ? [] : [$nameError]), ...array_values($this->provisioner->personErrors($email, $firstName, $lastName))];

        return array_map(static fn (string $code): string => match ($code) {
            AccountProvisioner::NAME_INVALID => \sprintf('The organization name must contain 1 to %d characters.', Organization::MAX_NAME_LENGTH),
            AccountProvisioner::NAME_TAKEN => 'An organization with this name already exists.',
            AccountProvisioner::EMAIL_INVALID => 'The e-mail is not valid.',
            AccountProvisioner::EMAIL_TAKEN => 'A user with this e-mail already exists.',
            AccountProvisioner::FIRST_NAME_INVALID => \sprintf('The first name must contain 1 to %d characters.', User::MAX_NAME_LENGTH),
            default => \sprintf('The last name must contain 1 to %d characters.', User::MAX_NAME_LENGTH),
        }, $codes);
    }
}
