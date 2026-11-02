<?php

namespace App\Tests\Controller;

use App\Controller\ProfileController;
use App\Entity\EmailChangeRequest;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Mime\Email;

final class ProfileControllerTest extends ProfileTestCase
{
    public function testUpdatesTheNamesAndTheJobTitle(): void
    {
        $this->jsonAs('PATCH', '/api/me', ['firstName' => ' Jeanne ', 'lastName' => 'Martin', 'jobTitle' => ' Responsable QHSE ']);

        self::assertResponseIsSuccessful();
        $data = $this->responseData();
        self::assertSame('Jeanne', $data['firstName']);
        self::assertSame('Martin', $data['lastName']);
        self::assertSame('Responsable QHSE', $data['jobTitle']);
        self::assertSame('Responsable QHSE', $this->userColumn('job_title'));
    }

    public function testAnEmptyJobTitleIsRemoved(): void
    {
        $this->jsonAs('PATCH', '/api/me', ['firstName' => 'Claire', 'lastName' => 'Dupont', 'jobTitle' => 'Dirigeante']);
        $this->jsonAs('PATCH', '/api/me', ['firstName' => 'Claire', 'lastName' => 'Dupont', 'jobTitle' => '  ']);

        self::assertResponseIsSuccessful();
        self::assertNull($this->userColumn('job_title'));
    }

    /**
     * @return iterable<string, array{array<string, string>, string}>
     */
    public static function invalidProfiles(): iterable
    {
        yield 'no first name' => [['firstName' => ' ', 'lastName' => 'Dupont', 'jobTitle' => ''], 'firstName'];
        yield 'no last name' => [['firstName' => 'Claire', 'lastName' => '', 'jobTitle' => ''], 'lastName'];
        yield 'first name too long' => [['firstName' => str_repeat('a', 101), 'lastName' => 'Dupont', 'jobTitle' => ''], 'firstName'];
        yield 'job title too long' => [['firstName' => 'Claire', 'lastName' => 'Dupont', 'jobTitle' => str_repeat('a', 101)], 'jobTitle'];
    }

    /**
     * @param array<string, string> $body
     */
    #[DataProvider('invalidProfiles')]
    public function testRejectsAnInvalidProfile(array $body, string $field): void
    {
        $this->jsonAs('PATCH', '/api/me', $body);

        self::assertResponseStatusCodeSame(422);
        $data = $this->responseData();
        self::assertSame('invalid_profile', $data['code']);
        self::assertIsArray($data['fields']);
        self::assertSame([$field], array_keys($data['fields']));
        self::assertSame('Claire', $this->userColumn('first_name'));
    }

    public function testProfileNeedsALoggedInUser(): void
    {
        $this->client->jsonRequest('PATCH', '/api/me', ['firstName' => 'Eve', 'lastName' => 'Hack', 'jobTitle' => '']);

        self::assertResponseStatusCodeSame(401);
    }

    public function testChangesThePasswordAndLogsOutTheOtherSessions(): void
    {
        $otherSession = $this->issueToken($this->user);

        $this->jsonAs('POST', '/api/me/password', ['currentPassword' => self::PASSWORD, 'newPassword' => 'a-brand-new-passphrase']);

        self::assertResponseStatusCodeSame(204);
        self::assertTrue($this->isTokenValid($this->token), 'The session that changed it stays open.');
        self::assertFalse($this->isTokenValid($otherSession));
        $this->client->jsonRequest('POST', '/api/auth/login', ['email' => self::EMAIL, 'password' => 'a-brand-new-passphrase']);
        self::assertResponseIsSuccessful();
    }

    public function testPasswordChangeNeedsTheCurrentPassword(): void
    {
        $passwordHash = $this->userColumn('password');

        $this->jsonAs('POST', '/api/me/password', ['currentPassword' => 'wrong-password-1', 'newPassword' => 'a-brand-new-passphrase']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['error' => ProfileController::WRONG_PASSWORD, 'code' => 'wrong_password'], $this->responseData());
        self::assertSame($passwordHash, $this->userColumn('password'));
    }

    public function testPasswordChangeRejectsAWeakPassword(): void
    {
        $this->jsonAs('POST', '/api/me/password', ['currentPassword' => self::PASSWORD, 'newPassword' => 'short']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('weak_password', $this->responseData()['code']);
    }

    public function testEmailChangeSendsALinkToTheNewAddressOnly(): void
    {
        $this->jsonAs('POST', '/api/me/email', ['email' => ' Claire@New.TEST ', 'currentPassword' => self::PASSWORD]);

        self::assertResponseStatusCodeSame(202);
        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertEmailAddressContains($email, 'To', 'claire@new.test');
        self::assertEmailHeaderSame($email, 'Subject', 'Confirmez votre nouvelle adresse e-mail');
        self::assertMatchesRegularExpression('#http://localhost:3000/email-confirmation\?token=[0-9a-f]{64}#', (string) $email->getTextBody());
        // Nothing changes until the link is opened
        self::assertSame(self::EMAIL, $this->userColumn('email'));
    }

    public function testEmailChangeNeedsTheCurrentPassword(): void
    {
        $this->jsonAs('POST', '/api/me/email', ['email' => 'claire@new.test', 'currentPassword' => 'wrong-password-1']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('wrong_password', $this->responseData()['code']);
        self::assertEmailCount(0);
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function refusedAddresses(): iterable
    {
        yield 'not an address' => ['claire-at-new', 'invalid_email'];
        yield 'empty' => ['', 'invalid_email'];
        yield 'current address' => [' CLAIRE.DUPONT@acme.test', 'same_email'];
    }

    #[DataProvider('refusedAddresses')]
    public function testEmailChangeRejectsTheAddress(string $address, string $code): void
    {
        $this->jsonAs('POST', '/api/me/email', ['email' => $address, 'currentPassword' => self::PASSWORD]);

        self::assertResponseStatusCodeSame(422);
        self::assertSame($code, $this->responseData()['code']);
        self::assertEmailCount(0);
    }

    public function testEmailChangeDoesNotTellThatAnAddressIsTaken(): void
    {
        $this->createUser('taken@other.test', null);

        $this->jsonAs('POST', '/api/me/email', ['email' => 'taken@other.test', 'currentPassword' => self::PASSWORD]);

        self::assertResponseStatusCodeSame(202);
        self::assertEmailCount(0);
        self::assertSame(0, $this->entityManager->getRepository(EmailChangeRequest::class)->count([]));
    }

    public function testTheSameAddressIsNotSentTwiceInARow(): void
    {
        $this->jsonAs('POST', '/api/me/email', ['email' => 'claire@new.test', 'currentPassword' => self::PASSWORD]);
        $this->jsonAs('POST', '/api/me/email', ['email' => 'claire@new.test', 'currentPassword' => self::PASSWORD]);

        self::assertResponseStatusCodeSame(202);
        self::assertEmailCount(0);
    }
}
