<?php

namespace App\Mailer;

use App\Entity\User;
use App\Security\ActivationTokenManager;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;

/**
 * Sends the e-mail with the link to choose a password (US-01). The link
 * opens the web app, which calls POST /api/activation.
 */
final class ActivationMailer
{
    public function __construct(
        private readonly MailerInterface $mailer,
        private readonly ActivationTokenManager $tokenManager,
        #[Autowire(env: 'APP_WEB_URL')]
        private readonly string $webUrl,
        #[Autowire(env: 'MAILER_FROM')]
        private readonly string $from,
        #[Autowire(param: 'app.activation_token_ttl')]
        private readonly int $ttl,
    ) {
    }

    public function send(User $user): void
    {
        $token = $this->tokenManager->issue($user);
        $url = rtrim($this->webUrl, '/').'/activation?token='.$token;

        $email = (new TemplatedEmail())
            ->from(new Address($this->from, 'Réglo'))
            ->to($user->getEmail())
            ->subject('Activez votre compte Réglo')
            ->htmlTemplate('emails/activation.html.twig')
            ->textTemplate('emails/activation.txt.twig')
            ->context([
                'first_name' => $user->getFirstName(),
                'organization_name' => $user->getOrganization()?->getName(),
                'activation_url' => $url,
                'valid_hours' => intdiv($this->ttl, 3600),
            ]);

        $this->mailer->send($email);
    }
}
