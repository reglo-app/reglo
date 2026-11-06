<?php

namespace App\Command;

use App\ActionPlan\ActionDueDates;
use App\Entity\Action;
use App\Entity\User;
use App\Mailer\ActionRemindersMailer;
use App\Repository\ActionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

/**
 * Tells each assignee, in one e-mail, which of their actions are late or due
 * soon (US-10). Planned every morning on the server (CONTRIBUTING.md). Can
 * be run again the same day: whoever got their e-mail does not get a second
 * one, and whoever could not be reached is tried again.
 */
#[AsCommand(name: 'app:send-action-reminders', description: 'E-mail each assignee their late and soon due actions')]
final class SendActionRemindersCommand extends Command
{
    public function __construct(
        private readonly ActionRepository $repository,
        private readonly ActionDueDates $dueDates,
        private readonly ActionRemindersMailer $mailer,
        private readonly EntityManagerInterface $entityManager,
        private readonly LoggerInterface $logger,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $today = $this->dueDates->today();

        /** @var array<int, array{assignee: User, actions: list<Action>}> $reminders */
        $reminders = [];
        foreach ($this->repository->findToRemind($today, $this->dueDates->dueSoonLimit()) as $action) {
            $assignee = $action->getAssignee();
            if (null !== $assignee) {
                $reminders[(int) $assignee->getId()]['assignee'] = $assignee;
                $reminders[(int) $assignee->getId()]['actions'][] = $action;
            }
        }

        $sent = 0;
        $failed = 0;
        foreach ($reminders as ['assignee' => $assignee, 'actions' => $actions]) {
            try {
                $this->mailer->send(
                    $assignee,
                    array_values(array_filter($actions, $this->dueDates->isOverdue(...))),
                    array_values(array_filter($actions, $this->dueDates->isDueSoon(...))),
                );
            } catch (TransportExceptionInterface $exception) {
                // The others still get theirs.
                $this->logger->error('Action reminder e-mail could not be sent.', ['exception' => $exception]);
                ++$failed;
                continue;
            }

            // Saved one by one: a crash must not send anything twice.
            $assignee->markActionRemindersSent($today);
            $this->entityManager->flush();
            ++$sent;
        }

        if ($failed > 0) {
            $io->error(\sprintf('%d e-mail(s) sent, %d failed.', $sent, $failed));

            return Command::FAILURE;
        }

        $io->success(\sprintf('%d e-mail(s) sent.', $sent));

        return Command::SUCCESS;
    }
}
