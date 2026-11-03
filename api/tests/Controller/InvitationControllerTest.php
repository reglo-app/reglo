<?php

namespace App\Tests\Controller;

use App\Controller\InvitationController;
use App\Entity\Organization;
use App\Security\InvitationManager;
use Symfony\Component\Mime\Email;

/**
 * US-03. The logged-in user of ProfileTestCase is the administrator of
 * Acme; Globex is another organization.
 */
final class InvitationControllerTest extends ProfileTestCase
{
    private const INVITED = 'paul.martin@acme.test';
    private const NEW_PASSWORD = 'another-long-password';
    /** Required when inviting. */
    private const NAMES = ['firstName' => 'Paul', 'lastName' => 'Martin'];

    private string $memberToken;
    private string $otherAdminToken;

    protected function setUp(): void
    {
        parent::setUp();
        // User ids restart at 1 in each test: forget the counted invitations.
        static::getContainer()->get('cache.rate_limiter_state')->clear();
        $this->user->setRoles(['ROLE_ADMIN']);
        $this->entityManager->flush();
        $this->memberToken = $this->issueToken($this->createUser('marc@acme.test', $this->organization));

        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);
        $otherAdmin = $this->createUser('admin@globex.test', $globex)->setRoles(['ROLE_ADMIN']);
        $this->entityManager->flush();
        $this->otherAdminToken = $this->issueToken($otherAdmin);
    }

    public function testAnAdministratorInvitesACollaborator(): void
    {
        $this->jsonAs('POST', '/api/invitations', ['email' => ' Paul.Martin@ACME.test '] + self::NAMES);

        self::assertResponseStatusCodeSame(201);
        $data = $this->responseData();
        self::assertSame(self::INVITED, $data['email']);
        self::assertSame('Paul', $data['firstName']);
        self::assertSame('Martin', $data['lastName']);
        self::assertSame('Claire Dupont', $data['invitedBy']);
        self::assertFalse($data['expired']);
        self::assertTrue($data['emailSent']);
        self::assertEqualsWithDelta(
            (new \DateTimeImmutable('+7 days'))->getTimestamp(),
            (new \DateTimeImmutable($data['expiresAt']))->getTimestamp(),
            60,
        );

        $email = $this->sentEmail();
        self::assertEmailAddressContains($email, 'To', self::INVITED);
        self::assertEmailHeaderSame($email, 'Subject', 'Rejoignez Acme sur Réglo');
        self::assertEmailTextBodyContains($email, 'Claire Dupont vous invite à rejoindre Acme');
        self::assertEmailTextBodyContains($email, 'valable 7 jours');
        // Only the hash of the token is stored.
        $token = self::tokenOf($email);
        self::assertSame(InvitationManager::hash($token), $this->invitationColumn('token_hash'));
    }

    public function testTheInvitedPersonJoinsTheOrganizationAsAMember(): void
    {
        $token = $this->invite();

        $this->client->jsonRequest('POST', '/api/invitations/check', ['token' => $token]);
        self::assertResponseIsSuccessful();
        self::assertSame([
            'email' => self::INVITED,
            'firstName' => 'Paul',
            'lastName' => 'Martin',
            'organizationName' => 'Acme',
            'role' => 'member',
            'inviterName' => 'Claire Dupont',
        ], $this->responseData());

        $this->accept($token);
        self::assertResponseStatusCodeSame(201);
        self::assertSame(['email' => self::INVITED], $this->responseData());
        self::assertFalse($this->invitationColumn('id'));

        $this->client->jsonRequest('POST', '/api/auth/login', ['email' => self::INVITED, 'password' => self::NEW_PASSWORD]);
        self::assertResponseIsSuccessful();
        $this->getAs('/api/auth/me', $this->responseData()['token']);
        $me = $this->responseData();
        self::assertSame('member', $me['role']);
        self::assertSame('Acme', $me['organization']['name']);
        self::assertSame(['Paul', 'Martin'], [$me['firstName'], $me['lastName']]);
    }

    public function testALinkWorksOnlyOnce(): void
    {
        $token = $this->invite();
        $this->accept($token);

        $this->accept($token);

        $this->assertInvalidLink();
    }

    public function testAnExpiredLinkIsRefusedAndShownAsExpired(): void
    {
        $token = $this->invite();
        // Same clock as the app (the database may use another time zone)
        $this->entityManager->getConnection()->executeStatement(
            'UPDATE invitation SET expires_at = ?',
            [(new \DateTimeImmutable('-1 minute'))->format('Y-m-d H:i:s')],
        );
        $this->entityManager->clear();

        $this->client->jsonRequest('POST', '/api/invitations/check', ['token' => $token]);
        $this->assertInvalidLink();
        $this->accept($token);
        $this->assertInvalidLink();

        $this->getAs('/api/invitations');
        self::assertTrue($this->responseList()[0]['expired']);
    }

    public function testAnUnknownTokenIsRefused(): void
    {
        $this->client->jsonRequest('POST', '/api/invitations/check', ['token' => str_repeat('a', 64)]);
        $this->assertInvalidLink();

        $this->client->jsonRequest('POST', '/api/invitations/check', []);
        $this->assertInvalidLink();
    }

    public function testAcceptingChecksTheNamesAndThePassword(): void
    {
        $token = $this->invite();

        $this->client->jsonRequest('POST', '/api/invitations/accept', ['token' => $token, 'firstName' => ' ', 'lastName' => 'Martin', 'password' => 'short']);

        self::assertResponseStatusCodeSame(422);
        $data = $this->responseData();
        self::assertSame('invalid_account', $data['code']);
        self::assertSame(['firstName', 'password'], array_keys($data['fields']));
        self::assertSame(0, $this->countUsers(self::INVITED));
        self::assertNotFalse($this->invitationColumn('id'));
    }

    public function testAnAddressRegisteredMeanwhileIsRefused(): void
    {
        $token = $this->invite();
        $this->createUser(self::INVITED, null);

        $this->accept($token);

        self::assertResponseStatusCodeSame(409);
        self::assertSame('email_unavailable', $this->responseData()['code']);
    }

    public function testAMemberCannotInviteNorSeeTheInvitations(): void
    {
        $this->jsonAs('POST', '/api/invitations', ['email' => self::INVITED] + self::NAMES, $this->memberToken);
        self::assertResponseStatusCodeSame(403);
        self::assertEmailCount(0);

        $this->getAs('/api/invitations', $this->memberToken);
        self::assertResponseStatusCodeSame(403);
    }

    public function testAMemberCannotCancelNorResend(): void
    {
        $this->invite();
        $id = $this->invitationColumn('id');

        $this->jsonAs('DELETE', '/api/invitations/'.$id, token: $this->memberToken);
        self::assertResponseStatusCodeSame(403);
        $this->jsonAs('POST', '/api/invitations/'.$id.'/resend', token: $this->memberToken);
        self::assertResponseStatusCodeSame(403);
        self::assertNotFalse($this->invitationColumn('id'));
    }

    public function testAPlatformAdministratorCannotInvite(): void
    {
        $platformAdmin = $this->createUser('team@reglo.test', null)->setRoles(['ROLE_PLATFORM_ADMIN']);
        $this->entityManager->flush();

        $this->jsonAs('POST', '/api/invitations', ['email' => self::INVITED] + self::NAMES, $this->issueToken($platformAdmin));

        self::assertResponseStatusCodeSame(403);
    }

    public function testAnonymousRequestsAreRejected(): void
    {
        $this->client->request('GET', '/api/invitations');
        self::assertResponseStatusCodeSame(401);

        $this->client->jsonRequest('POST', '/api/invitations', ['email' => self::INVITED] + self::NAMES);
        self::assertResponseStatusCodeSame(401);
    }

    public function testAnAddressAlreadyRegisteredIsRefusedWithANeutralMessage(): void
    {
        // In another organization: the message must not tell it.
        foreach (['admin@globex.test', 'MARC@acme.test'] as $email) {
            $this->jsonAs('POST', '/api/invitations', ['email' => $email] + self::NAMES);

            self::assertResponseStatusCodeSame(422);
            self::assertSame(['error' => InvitationController::EMAIL_UNAVAILABLE, 'code' => 'email_unavailable'], $this->responseData());
        }
        self::assertEmailCount(0);
    }

    public function testAnAddressAlreadyInvitedIsRefused(): void
    {
        $this->invite();

        $this->jsonAs('POST', '/api/invitations', ['email' => self::INVITED] + self::NAMES);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('already_invited', $this->responseData()['code']);
    }

    public function testTwoOrganizationsCanInviteTheSameAddress(): void
    {
        $this->invite();

        $this->jsonAs('POST', '/api/invitations', ['email' => self::INVITED] + self::NAMES, $this->otherAdminToken);

        self::assertResponseStatusCodeSame(201);
    }

    public function testInvalidFieldsAreRefused(): void
    {
        $this->jsonAs('POST', '/api/invitations', ['email' => 'not-an-email', 'firstName' => 'Paul', 'lastName' => str_repeat('a', 101)]);

        self::assertResponseStatusCodeSame(422);
        $data = $this->responseData();
        self::assertSame('invalid_invitation', $data['code']);
        self::assertSame(['email', 'lastName'], array_keys($data['fields']));
        self::assertSame('Saisissez une adresse e-mail valide.', $data['error']);
    }

    public function testTheNamesAreRequired(): void
    {
        $this->jsonAs('POST', '/api/invitations', ['email' => self::INVITED, 'firstName' => ' ']);

        self::assertResponseStatusCodeSame(422);
        $data = $this->responseData();
        self::assertSame(['firstName', 'lastName'], array_keys($data['fields']));
        self::assertSame('Saisissez le prénom de la personne à inviter.', $data['error']);
        self::assertEmailCount(0);
    }

    public function testTheListShowsOnlyThePendingInvitationsOfTheOwnOrganization(): void
    {
        $this->jsonAs('POST', '/api/invitations', ['email' => 'someone@globex.test'] + self::NAMES, $this->otherAdminToken);
        $this->invite();

        $this->getAs('/api/invitations');

        self::assertResponseIsSuccessful();
        self::assertSame([self::INVITED], array_column($this->responseData(), 'email'));
    }

    public function testAnInvitationOfAnotherOrganizationCannotBeCancelledNorResent(): void
    {
        $this->jsonAs('POST', '/api/invitations', ['email' => 'someone@globex.test'] + self::NAMES, $this->otherAdminToken);
        $otherId = $this->responseData()['id'];

        $this->jsonAs('DELETE', '/api/invitations/'.$otherId);
        self::assertResponseStatusCodeSame(404);
        $this->jsonAs('POST', '/api/invitations/'.$otherId.'/resend');
        self::assertResponseStatusCodeSame(404);

        self::assertSame(1, (int) $this->entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM invitation WHERE id = ?', [$otherId]));
    }

    public function testCancellingDeletesTheInvitationAndItsLink(): void
    {
        $token = $this->invite();

        $this->jsonAs('DELETE', '/api/invitations/'.$this->invitationColumn('id'));

        self::assertResponseStatusCodeSame(204);
        self::assertFalse($this->invitationColumn('id'));
        $this->client->jsonRequest('POST', '/api/invitations/check', ['token' => $token]);
        $this->assertInvalidLink();
    }

    public function testResendingGivesANewLinkValidAgain(): void
    {
        $oldToken = $this->invite();
        $this->entityManager->getConnection()->executeStatement(
            'UPDATE invitation SET expires_at = ?',
            [(new \DateTimeImmutable('-1 day'))->format('Y-m-d H:i:s')],
        );
        $this->entityManager->clear();

        $this->jsonAs('POST', '/api/invitations/'.$this->invitationColumn('id').'/resend');

        self::assertResponseIsSuccessful();
        $data = $this->responseData();
        self::assertFalse($data['expired']);
        self::assertTrue($data['emailSent']);
        $newToken = self::tokenOf($this->sentEmail());
        self::assertNotSame($oldToken, $newToken);

        $this->client->jsonRequest('POST', '/api/invitations/check', ['token' => $oldToken]);
        $this->assertInvalidLink();
        $this->client->jsonRequest('POST', '/api/invitations/check', ['token' => $newToken]);
        self::assertResponseIsSuccessful();
    }

    public function testTooManyInvitationsAreRefused(): void
    {
        for ($i = 1; $i <= 20; ++$i) {
            $this->jsonAs('POST', '/api/invitations', ['email' => \sprintf('person%d@acme.test', $i)] + self::NAMES);
            self::assertResponseStatusCodeSame(201);
        }

        $this->jsonAs('POST', '/api/invitations', ['email' => 'one-too-many@acme.test'] + self::NAMES);

        self::assertResponseStatusCodeSame(429);
        self::assertSame(['error' => InvitationController::TOO_MANY, 'code' => 'too_many_invitations'], $this->responseData());
    }

    public function testTheInvitationGivesItsRole(): void
    {
        $this->jsonAs('POST', '/api/invitations', ['email' => self::INVITED, 'role' => 'reader'] + self::NAMES);
        self::assertResponseStatusCodeSame(201);
        self::assertSame('reader', $this->responseData()['role']);

        $this->accept(self::tokenOf($this->sentEmail()));

        self::assertResponseStatusCodeSame(201);
        $this->client->jsonRequest('POST', '/api/auth/login', ['email' => self::INVITED, 'password' => self::NEW_PASSWORD]);
        $this->getAs('/api/auth/me', $this->responseData()['token']);
        self::assertSame('reader', $this->responseData()['role']);
    }

    public function testAnUnknownRoleIsRefused(): void
    {
        $this->jsonAs('POST', '/api/invitations', ['email' => self::INVITED, 'role' => 'owner'] + self::NAMES);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['role'], array_keys($this->responseData()['fields']));
        self::assertEmailCount(0);
    }

    /**
     * Invites INVITED as the administrator and returns the token of the
     * e-mail.
     */
    private function invite(): string
    {
        $this->jsonAs('POST', '/api/invitations', ['email' => self::INVITED] + self::NAMES);
        self::assertResponseStatusCodeSame(201);

        return self::tokenOf($this->sentEmail());
    }

    private function accept(string $token): void
    {
        $this->client->jsonRequest('POST', '/api/invitations/accept', [
            'token' => $token,
            'firstName' => 'Paul',
            'lastName' => 'Martin',
            'password' => self::NEW_PASSWORD,
        ]);
    }

    private function sentEmail(): Email
    {
        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);

        return $email;
    }

    private static function tokenOf(Email $email): string
    {
        self::assertSame(1, preg_match('#/invitation\?token=([0-9a-f]{64})#', (string) $email->getTextBody(), $matches));

        return $matches[1];
    }

    private function invitationColumn(string $column): mixed
    {
        return $this->entityManager->getConnection()->fetchOne(
            \sprintf('SELECT %s FROM invitation WHERE email = ? ORDER BY id', $column),
            [self::INVITED],
        );
    }

    private function countUsers(string $email): int
    {
        return (int) $this->entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM app_user WHERE email = ?', [$email]);
    }

    private function assertInvalidLink(): void
    {
        self::assertResponseStatusCodeSame(410);
        self::assertSame(['error' => InvitationController::INVALID_LINK, 'code' => 'invalid_token'], $this->responseData());
    }
}
