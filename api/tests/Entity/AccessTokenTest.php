<?php

namespace App\Tests\Entity;

use App\Entity\AccessToken;
use App\Entity\User;
use PHPUnit\Framework\TestCase;

final class AccessTokenTest extends TestCase
{
    public function testIsNotExpiredBeforeExpiryDate(): void
    {
        $token = new AccessToken(new User('a@example.com'), 'hash', new \DateTimeImmutable('2026-10-16 10:00:00'));

        self::assertFalse($token->isExpired(new \DateTimeImmutable('2026-10-16 09:59:59')));
    }

    public function testIsExpiredAtAndAfterExpiryDate(): void
    {
        $token = new AccessToken(new User('a@example.com'), 'hash', new \DateTimeImmutable('2026-10-16 10:00:00'));

        self::assertTrue($token->isExpired(new \DateTimeImmutable('2026-10-16 10:00:00')));
        self::assertTrue($token->isExpired(new \DateTimeImmutable('2026-10-16 10:00:01')));
    }
}
