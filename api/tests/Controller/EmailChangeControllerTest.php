<?php

namespace App\Tests\Controller;

use App\Controller\EmailChangeController;
use App\Security\EmailChangeManager;
use Symfony\Component\Mime\Email;

final class EmailChangeControllerTest extends ProfileTestCase
{
    private const NEW_EMAIL = 'claire@new.test';

    public function testCheckReturnsTheNewAddress(): void
    {
        $token = $this->requestChange();

        $this->client->jsonRequest('POST', '/api/email-change/check', ['token' => $token]);

        self::assertResponseIsSuccessful();
        self::assertSame(['newEmail' => self::NEW_EMAIL], $this->responseData());
    }

    public function testConfirmationChangesTheAddressAndLogsOutEverywhere(): void
    {
        $token = $this->requestChange();

        $this->client->jsonRequest('POST', '/api/email-change/confirm', ['token' => $token]);

        self::assertResponseStatusCodeSame(204);
        self::assertSame(self::NEW_EMAIL, $this->userColumn('email'));
        self::assertFalse($this->isTokenValid($this->token));
        $this->client->jsonRequest('POST', '/api/auth/login', ['email' => self::NEW_EMAIL, 'password' => self::PASSWORD]);
        self::assertResponseIsSuccessful();
    }

    public function testTheOldAddressIsWarned(): void
    {
        $this->client->jsonRequest('POST', '/api/email-change/confirm', ['token' => $this->requestChange()]);

        self::assertEmailCount(1);
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertEmailAddressContains($email, 'To', self::EMAIL);
        self::assertEmailHeaderSame($email, 'Subject', 'Votre adresse e-mail Réglo a été modifiée');
        self::assertEmailTextBodyContains($email, self::NEW_EMAIL);
    }

    public function testALinkWorksOnlyOnce(): void
    {
        $token = $this->requestChange();
        $this->client->jsonRequest('POST', '/api/email-change/confirm', ['token' => $token]);

        $this->client->jsonRequest('POST', '/api/email-change/confirm', ['token' => $token]);

        $this->assertInvalidLink();
    }

    public function testOnlyTheLatestLinkWorks(): void
    {
        $first = $this->requestChange();
        $this->requestChange();

        $this->client->jsonRequest('POST', '/api/email-change/confirm', ['token' => $first]);

        $this->assertInvalidLink();
        self::assertSame(self::EMAIL, $this->userColumn('email'));
    }

    public function testAnExpiredLinkIsRefused(): void
    {
        $token = $this->requestChange();
        // Same clock as the app (the database may use another time zone)
        $this->entityManager->getConnection()->executeStatement(
            'UPDATE email_change_request SET expires_at = ?',
            [(new \DateTimeImmutable('-1 minute'))->format('Y-m-d H:i:s')],
        );
        // The first request shares this entity manager: forget the old value
        $this->entityManager->clear();

        $this->client->jsonRequest('POST', '/api/email-change/check', ['token' => $token]);

        $this->assertInvalidLink();
    }

    public function testAnUnknownTokenIsRefused(): void
    {
        $this->client->jsonRequest('POST', '/api/email-change/confirm', ['token' => str_repeat('a', 64)]);

        $this->assertInvalidLink();
    }

    public function testAnAddressTakenMeanwhileIsRefused(): void
    {
        $token = $this->requestChange();
        $this->createUser(self::NEW_EMAIL, null);

        $this->client->jsonRequest('POST', '/api/email-change/confirm', ['token' => $token]);

        self::assertResponseStatusCodeSame(409);
        self::assertSame('email_unavailable', $this->responseData()['code']);
        self::assertSame(self::EMAIL, $this->userColumn('email'));
    }

    private function requestChange(): string
    {
        return static::getContainer()->get(EmailChangeManager::class)->request($this->user, self::NEW_EMAIL);
    }

    private function assertInvalidLink(): void
    {
        self::assertResponseStatusCodeSame(410);
        self::assertSame(['error' => EmailChangeController::INVALID_LINK, 'code' => 'invalid_token'], $this->responseData());
    }
}
