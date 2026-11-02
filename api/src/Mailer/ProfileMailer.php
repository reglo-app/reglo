<?php

namespace App\Mailer;

use App\Entity\User;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;

/**
 * E-mails about the account itself: confirmation of a new e-mail address,
 * and the notice sent to the old one once it changed.
 */
final class ProfileMailer
{
    public function __construct(
        private readonly MailerInterface $mailer,
        #[Autowire(env: 'APP_WEB_URL')]
        private readonly string $webUrl,
        #[Autowire(env: 'MAILER_FROM')]
        private readonly string $from,
        #[Autowire(param: 'app.email_change_ttl')]
        private readonly int $ttl,
    ) {
    }

    public function sendEmailChangeConfirmation(User $user, string $newEmail, string $plainToken): void
    {
        $this->mailer->send($this->email($newEmail, 'Confirmez votre nouvelle adresse e-mail', 'email_change', [
            'first_name' => $user->getFirstName(),
            'confirmation_url' => rtrim($this->webUrl, '/').'/email-confirmation?token='.$plainToken,
            'valid_hours' => intdiv($this->ttl, 3600),
        ]));
    }

    /**
     * Sent to the old address: if the user did not ask for the change, they
     * learn it at once.
     */
    public function sendEmailChangedNotice(User $user, string $oldEmail): void
    {
        $this->mailer->send($this->email($oldEmail, 'Votre adresse e-mail Réglo a été modifiée', 'email_changed', [
            'first_name' => $user->getFirstName(),
            'new_email' => $user->getEmail(),
        ]));
    }

    /**
     * @param array<string, mixed> $context
     */
    private function email(string $to, string $subject, string $template, array $context): TemplatedEmail
    {
        return (new TemplatedEmail())
            ->from(new Address($this->from, 'Réglo'))
            ->to($to)
            ->subject($subject)
            ->htmlTemplate(\sprintf('emails/%s.html.twig', $template))
            ->textTemplate(\sprintf('emails/%s.txt.twig', $template))
            ->context($context);
    }
}
