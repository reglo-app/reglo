<?php

namespace App\Tests\Controller;

use App\Controller\ActivationController;
use App\Entity\ActivationToken;
use App\Entity\Organization;
use App\Entity\User;
use App\Security\ActivationTokenManager;
use App\Tests\DatabaseResetTrait;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class ActivationControllerTest extends WebTestCase
{
    use DatabaseResetTrait;

    private const EMAIL = 'claire.dupont@acme.test';
    private const PASSWORD = 'correct-horse-battery';

    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        self::resetDatabase($this->entityManager);
    }

    public function testCheckReturnsWhoTheLinkIsFor(): void
    {
        $token = $this->issueToken($this->createInvitedUser());

        $this->client->jsonRequest('POST', '/api/activation/check', ['token' => $token]);

        self::assertResponseIsSuccessful();
        self::assertSame([
            'email' => self::EMAIL,
            'firstName' => 'Claire',
            'organizationName' => 'Acme',
        ], $this->responseData());
    }

    public function testCheckRejectsAnUnknownToken(): void
    {
        $this->client->jsonRequest('POST', '/api/activation/check', ['token' => str_repeat('a', 64)]);

        $this->assertInvalidLink();
    }

    public function testActivationSetsThePasswordAndAllowsLogin(): void
    {
        $user = $this->createInvitedUser();
        $token = $this->issueToken($user);

        $this->activate($token, self::PASSWORD);

        self::assertResponseStatusCodeSame(204);
        $this->entityManager->refresh($user);
        self::assertTrue($user->isActivated());
        self::assertContains('ROLE_ADMIN', $user->getRoles());
        self::assertSame('Acme', $user->getOrganization()?->getName());

        $this->client->jsonRequest('POST', '/api/auth/login', ['email' => self::EMAIL, 'password' => self::PASSWORD]);
        self::assertResponseIsSuccessful();
    }

    public function testALinkCanOnlyBeUsedOnce(): void
    {
        $token = $this->issueToken($this->createInvitedUser());
        $this->activate($token, self::PASSWORD);

        $this->activate($token, 'another-long-password');

        $this->assertInvalidLink();
        self::assertCount(0, $this->entityManager->getRepository(ActivationToken::class)->findAll());
    }

    public function testAnExpiredLinkIsRejected(): void
    {
        $user = $this->createInvitedUser();
        $plainToken = 'expired-token';
        $this->entityManager->persist(new ActivationToken($user, ActivationTokenManager::hash($plainToken), new \DateTimeImmutable('-1 second')));
        $this->entityManager->flush();

        $this->activate($plainToken, self::PASSWORD);

        $this->assertInvalidLink();
        $this->entityManager->refresh($user);
        self::assertFalse($user->isActivated());
    }

    public function testTheStoredHashIsNotAValidToken(): void
    {
        $token = $this->issueToken($this->createInvitedUser());

        $this->activate(ActivationTokenManager::hash($token), self::PASSWORD);

        $this->assertInvalidLink();
    }

    public function testANewLinkReplacesThePreviousOne(): void
    {
        $user = $this->createInvitedUser();
        $first = $this->issueToken($user);
        $second = $this->issueToken($user);

        $this->activate($first, self::PASSWORD);
        $this->assertInvalidLink();

        $this->activate($second, self::PASSWORD);
        self::assertResponseStatusCodeSame(204);
    }

    public function testAShortPasswordIsRejectedAndTheLinkStaysValid(): void
    {
        $user = $this->createInvitedUser();
        $token = $this->issueToken($user);

        $this->activate($token, 'short-pass1');

        self::assertResponseStatusCodeSame(422);
        self::assertSame('weak_password', $this->responseData()['code']);
        $this->entityManager->refresh($user);
        self::assertFalse($user->isActivated());

        $this->activate($token, self::PASSWORD);
        self::assertResponseStatusCodeSame(204);
    }

    public function testMalformedRequestsAreTreatedAsAnInvalidLink(): void
    {
        $this->client->request('POST', '/api/activation', content: 'not json');
        $this->assertInvalidLink();

        $this->client->jsonRequest('POST', '/api/activation', ['token' => ['array'], 'password' => self::PASSWORD]);
        $this->assertInvalidLink();
    }

    public function testResendSendsANewLinkToANotActivatedUser(): void
    {
        $user = $this->createInvitedUser();
        $this->createExpiredToken($user);

        $this->client->jsonRequest('POST', '/api/activation/resend', ['email' => 'Claire.Dupont@acme.test']);

        self::assertResponseStatusCodeSame(202);
        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertNotNull($email);
        self::assertEmailAddressContains($email, 'To', self::EMAIL);
    }

    public function testResendIsLimitedToOneLinkPerPeriod(): void
    {
        $this->issueToken($this->createInvitedUser());

        $this->client->jsonRequest('POST', '/api/activation/resend', ['email' => self::EMAIL]);

        self::assertResponseStatusCodeSame(202);
        self::assertEmailCount(0);
    }

    public function testResendGivesTheSameAnswerForUnknownAndActivatedAccounts(): void
    {
        $user = $this->createInvitedUser();
        $user->activate('hash');
        $this->entityManager->flush();

        $this->client->jsonRequest('POST', '/api/activation/resend', ['email' => self::EMAIL]);
        self::assertResponseStatusCodeSame(202);
        $activatedBody = $this->client->getResponse()->getContent();

        $this->client->jsonRequest('POST', '/api/activation/resend', ['email' => 'unknown@acme.test']);
        self::assertResponseStatusCodeSame(202);
        self::assertSame($activatedBody, $this->client->getResponse()->getContent());
        self::assertEmailCount(0);
    }

    public function testRoutesArePublicButOnlyAcceptPost(): void
    {
        $this->client->request('GET', '/api/activation/check');

        self::assertResponseStatusCodeSame(405);
    }

    private function createInvitedUser(): User
    {
        $organization = new Organization('Acme');
        $user = (new User(self::EMAIL))
            ->setName('Claire', 'Dupont')
            ->setOrganization($organization)
            ->setRoles(['ROLE_ADMIN']);

        $this->entityManager->persist($organization);
        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return $user;
    }

    private function issueToken(User $user): string
    {
        return static::getContainer()->get(ActivationTokenManager::class)->issue($user);
    }

    private function createExpiredToken(User $user): void
    {
        $token = new ActivationToken($user, ActivationTokenManager::hash('old'), new \DateTimeImmutable('-1 hour'));
        // Created long ago: the resend cooldown is over
        (new \ReflectionProperty(ActivationToken::class, 'createdAt'))->setValue($token, new \DateTimeImmutable('-49 hours'));
        $this->entityManager->persist($token);
        $this->entityManager->flush();
    }

    private function activate(string $token, string $password): void
    {
        $this->client->jsonRequest('POST', '/api/activation', ['token' => $token, 'password' => $password]);
    }

    private function assertInvalidLink(): void
    {
        self::assertResponseStatusCodeSame(410);
        self::assertSame(['error' => ActivationController::INVALID_LINK, 'code' => 'invalid_token'], $this->responseData());
    }

    /**
     * @return array<string, mixed>
     */
    private function responseData(): array
    {
        $data = json_decode((string) $this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertIsArray($data);

        return $data;
    }
}
