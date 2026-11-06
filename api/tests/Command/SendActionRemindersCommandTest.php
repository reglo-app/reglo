<?php

namespace App\Tests\Command;

use App\ActionPlan\ActionDueDates;
use App\Command\SendActionRemindersCommand;
use App\Entity\Action;
use App\Entity\ActionStatus;
use App\Entity\ActionType;
use App\Entity\Organization;
use App\Entity\QhsePillar;
use App\Entity\User;
use App\Mailer\ActionRemindersMailer;
use App\Repository\ActionRepository;
use App\Tests\DatabaseResetTrait;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\NullLogger;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;

/**
 * US-10. "Today" is frozen on 10 November 2026 in France.
 */
final class SendActionRemindersCommandTest extends KernelTestCase
{
    use ClockSensitiveTrait;
    use DatabaseResetTrait;

    private EntityManagerInterface $entityManager;
    private Organization $organization;
    private CommandTester $tester;

    protected function setUp(): void
    {
        $kernel = self::bootKernel();
        self::mockTime('2026-11-10 05:00:00 UTC');
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        self::resetDatabase($this->entityManager);

        $this->organization = new Organization('Acme');
        $this->entityManager->persist($this->organization);
        $this->tester = new CommandTester((new Application($kernel))->find('app:send-action-reminders'));
    }

    public function testAnAssigneeGetsOneEmailWithTheirLateAndSoonDueActions(): void
    {
        $paul = $this->createUser('paul@acme.test');
        $this->createAction('Réviser le DUERP', '2026-11-09', $paul);
        $this->createAction('Vérifier les extincteurs', '2026-11-17', $paul);
        $this->createAction('Former l\'équipe', '2026-11-18', $paul);

        self::assertSame(Command::SUCCESS, $this->tester->execute([]));

        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame('paul@acme.test', $email->getTo()[0]->getAddress());
        self::assertSame('Vos actions à suivre : 1 en retard, 1 à échéance proche', $email->getSubject());
        $text = (string) $email->getTextBody();
        self::assertStringContainsString('Bonjour Paul,', $text);
        self::assertStringContainsString('En retard :', $text);
        self::assertStringContainsString('Réviser le DUERP (Sécurité, échéance le 09/11/2026)', $text);
        self::assertStringContainsString('Échéance dans 7 jours ou moins :', $text);
        self::assertStringContainsString('Vérifier les extincteurs', $text);
        self::assertStringNotContainsString('Former l\'équipe', $text);
        self::assertStringContainsString('/actions?assignee='.$paul->getId(), $text);
        self::assertStringContainsString('Réviser le DUERP', (string) $email->getHtmlBody());
    }

    public function testTheSubjectOnlyNamesWhatThereIs(): void
    {
        $this->createAction('Vérifier les extincteurs', '2026-11-12', $this->createUser('paul@acme.test'));

        $this->tester->execute([]);

        self::assertSame('Vos actions à suivre : 1 à échéance proche', self::lastEmail()->getSubject());
    }

    public function testEachAssigneeOnlyGetsTheirOwnActions(): void
    {
        $this->createAction('Action de Paul', '2026-11-09', $this->createUser('paul@acme.test'));
        $this->createAction('Action de Léa', '2026-11-09', $this->createUser('lea@acme.test'));

        $other = new Organization('Globex');
        $this->entityManager->persist($other);
        $this->createAction('Action de Sam', '2026-11-09', $this->createUser('sam@globex.test', $other), $other);

        $this->tester->execute([]);

        self::assertEmailCount(3);
        foreach (self::getMailerMessages() as $email) {
            self::assertInstanceOf(Email::class, $email);
            $expected = match ($email->getTo()[0]->getAddress()) {
                'paul@acme.test' => 'Action de Paul',
                'lea@acme.test' => 'Action de Léa',
                'sam@globex.test' => 'Action de Sam',
                default => self::fail('Unexpected recipient'),
            };
            self::assertSame(1, substr_count((string) $email->getTextBody(), 'Action de'));
            self::assertStringContainsString($expected, (string) $email->getTextBody());
        }
    }

    public function testNoEmailWhenNothingIsLateOrDueSoon(): void
    {
        $paul = $this->createUser('paul@acme.test');
        $this->createAction('Plus tard', '2026-11-18', $paul);
        $this->createAction('Terminée', '2026-11-01', $paul, status: ActionStatus::Done);

        self::assertSame(Command::SUCCESS, $this->tester->execute([]));

        self::assertEmailCount(0);
    }

    public function testNoEmailForAnAccountThatIsNotActivated(): void
    {
        $user = (new User('pending@acme.test'))->setOrganization($this->organization);
        $this->entityManager->persist($user);
        $this->createAction('Action', '2026-11-09', $user);

        $this->tester->execute([]);

        self::assertEmailCount(0);
    }

    public function testRunningItAgainTheSameDaySendsNothing(): void
    {
        $this->createAction('Action', '2026-11-09', $this->createUser('paul@acme.test'));

        $this->tester->execute([]);
        $this->tester->execute([]);

        self::assertEmailCount(1);
    }

    public function testTheEmailComesBackTheNextDay(): void
    {
        $this->createAction('Action', '2026-11-09', $this->createUser('paul@acme.test'));
        $this->tester->execute([]);

        self::mockTime('2026-11-11 05:00:00 UTC');
        $this->tester->execute([]);

        self::assertEmailCount(2);
    }

    public function testAFailedEmailDoesNotStopTheOthersAndIsTriedAgain(): void
    {
        $paul = $this->createUser('paul@acme.test');
        $lea = $this->createUser('lea@acme.test');
        $this->createAction('Action de Paul', '2026-11-09', $paul);
        $this->createAction('Action de Léa', '2026-11-09', $lea);

        /** @var \ArrayObject<int, string> $sentTo */
        $sentTo = new \ArrayObject();
        $failing = new class($sentTo) implements MailerInterface {
            /** @param \ArrayObject<int, string> $sentTo */
            public function __construct(private readonly \ArrayObject $sentTo)
            {
            }

            public function send(RawMessage $message, ?Envelope $envelope = null): void
            {
                \assert($message instanceof Email);
                $recipient = $message->getTo()[0]->getAddress();
                if ('paul@acme.test' === $recipient) {
                    throw new TransportException('Connection refused');
                }
                $this->sentTo->append($recipient);
            }
        };
        $command = new SendActionRemindersCommand(
            static::getContainer()->get(ActionRepository::class),
            static::getContainer()->get(ActionDueDates::class),
            new ActionRemindersMailer($failing, 'https://app.test', 'no-reply@reglo.test'),
            $this->entityManager,
            new NullLogger(),
        );
        $tester = new CommandTester($command);

        self::assertSame(Command::FAILURE, $tester->execute([]));

        self::assertSame(['lea@acme.test'], $sentTo->getArrayCopy());
        self::assertNull($paul->getActionRemindersSentOn());
        self::assertSame('2026-11-10', $lea->getActionRemindersSentOn()?->format('Y-m-d'));

        // Paul only, on the next run.
        self::assertSame(Command::SUCCESS, $this->tester->execute([]));
        self::assertEmailCount(1);
        self::assertSame('paul@acme.test', self::lastEmail()->getTo()[0]->getAddress());
    }

    private static function lastEmail(): Email
    {
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);

        return $email;
    }

    private function createUser(string $email, ?Organization $organization = null): User
    {
        $user = (new User($email))->setOrganization($organization ?? $this->organization)->setName(ucfirst((string) strstr($email, '@', true)), 'Martin');
        $user->activate('hashed-password');
        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return $user;
    }

    private function createAction(string $title, string $dueDate, User $assignee, ?Organization $organization = null, ActionStatus $status = ActionStatus::Todo): void
    {
        $action = new Action($organization ?? $this->organization, $title, '', QhsePillar::Safety, ActionType::Preventive, new \DateTimeImmutable($dueDate), $assignee, $assignee);
        if (ActionStatus::Todo !== $status) {
            $action->moveTo($status, $assignee);
        }
        $this->entityManager->persist($action);
        $this->entityManager->flush();
    }
}
