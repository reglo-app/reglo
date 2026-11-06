<?php

namespace App\Mailer;

use App\Entity\Action;
use App\Entity\User;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;

/**
 * The daily summary of an assignee's late and soon due actions (US-10).
 */
final class ActionRemindersMailer
{
    public function __construct(
        private readonly MailerInterface $mailer,
        #[Autowire(env: 'APP_WEB_URL')]
        private readonly string $webUrl,
        #[Autowire(env: 'MAILER_FROM')]
        private readonly string $from,
    ) {
    }

    /**
     * @param list<Action> $overdue
     * @param list<Action> $dueSoon
     */
    public function send(User $assignee, array $overdue, array $dueSoon): void
    {
        $email = (new TemplatedEmail())
            ->from(new Address($this->from, 'Réglo'))
            ->to($assignee->getEmail())
            ->subject(self::subject(\count($overdue), \count($dueSoon)))
            ->htmlTemplate('emails/action_reminders.html.twig')
            ->textTemplate('emails/action_reminders.txt.twig')
            ->context([
                'first_name' => $assignee->getFirstName(),
                'overdue' => array_map($this->line(...), $overdue),
                'due_soon' => array_map($this->line(...), $dueSoon),
                'actions_url' => \sprintf('%s/actions?assignee=%d', rtrim($this->webUrl, '/'), $assignee->getId()),
            ]);

        $this->mailer->send($email);
    }

    private static function subject(int $overdue, int $dueSoon): string
    {
        $parts = [];
        if ($overdue > 0) {
            $parts[] = \sprintf('%d en retard', $overdue);
        }
        if ($dueSoon > 0) {
            $parts[] = \sprintf('%d à échéance proche', $dueSoon);
        }

        return \sprintf('Vos actions à suivre : %s', implode(', ', $parts));
    }

    /**
     * @return array{title: string, pillar: string, due_date: string, url: string}
     */
    private function line(Action $action): array
    {
        return [
            'title' => $action->getTitle(),
            'pillar' => $action->getPillar()->label(),
            'due_date' => $action->getDueDate()->format('d/m/Y'),
            'url' => \sprintf('%s/actions/%d', rtrim($this->webUrl, '/'), $action->getId()),
        ];
    }
}
