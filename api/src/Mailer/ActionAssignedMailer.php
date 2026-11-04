<?php

namespace App\Mailer;

use App\Entity\Action;
use App\Entity\User;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;

/**
 * Tells a member that an action was given to them (US-09). The link opens
 * the action in the web app.
 */
final class ActionAssignedMailer
{
    public function __construct(
        private readonly MailerInterface $mailer,
        #[Autowire(env: 'APP_WEB_URL')]
        private readonly string $webUrl,
        #[Autowire(env: 'MAILER_FROM')]
        private readonly string $from,
    ) {
    }

    public function send(Action $action, User $assignedBy): void
    {
        $assignee = $action->getAssignee();
        if (null === $assignee) {
            return;
        }

        $byName = trim(\sprintf('%s %s', $assignedBy->getFirstName(), $assignedBy->getLastName()));

        $email = (new TemplatedEmail())
            ->from(new Address($this->from, 'Réglo'))
            ->to($assignee->getEmail())
            ->subject(\sprintf('Une action vous est confiée : %s', $action->getTitle()))
            ->htmlTemplate('emails/action_assigned.html.twig')
            ->textTemplate('emails/action_assigned.txt.twig')
            ->context([
                'first_name' => $assignee->getFirstName(),
                'assigned_by' => '' === $byName ? null : $byName,
                'title' => $action->getTitle(),
                'pillar' => $action->getPillar()->label(),
                'due_date' => $action->getDueDate()->format('d/m/Y'),
                'action_url' => \sprintf('%s/actions/%d', rtrim($this->webUrl, '/'), $action->getId()),
            ]);

        $this->mailer->send($email);
    }
}
