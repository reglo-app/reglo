<?php

namespace App\Mailer;

use App\Entity\Invitation;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;

/**
 * Sends the invitation of a collaborator (US-03). The link opens the web
 * app, which calls POST /api/invitations/accept.
 */
final class InvitationMailer
{
    public function __construct(
        private readonly MailerInterface $mailer,
        #[Autowire(env: 'APP_WEB_URL')]
        private readonly string $webUrl,
        #[Autowire(env: 'MAILER_FROM')]
        private readonly string $from,
        #[Autowire(param: 'app.invitation_ttl')]
        private readonly int $ttl,
    ) {
    }

    public function send(Invitation $invitation, string $plainToken): void
    {
        $organizationName = (string) $invitation->getOrganization()?->getName();
        $inviter = $invitation->getInvitedBy();
        $inviterName = null === $inviter
            ? null
            : trim(\sprintf('%s %s', $inviter->getFirstName(), $inviter->getLastName()));

        $email = (new TemplatedEmail())
            ->from(new Address($this->from, 'Réglo'))
            ->to($invitation->getEmail())
            ->subject(\sprintf('Rejoignez %s sur Réglo', $organizationName))
            ->htmlTemplate('emails/invitation.html.twig')
            ->textTemplate('emails/invitation.txt.twig')
            ->context([
                'first_name' => $invitation->getFirstName(),
                'inviter_name' => '' === $inviterName ? null : $inviterName,
                'organization_name' => $organizationName,
                'invitation_url' => rtrim($this->webUrl, '/').'/invitation?token='.$plainToken,
                'valid_days' => intdiv($this->ttl, 86400),
            ]);

        $this->mailer->send($email);
    }
}
