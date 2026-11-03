<?php

namespace App\Tests\Entity;

use App\Entity\User;
use PHPUnit\Framework\TestCase;

final class UserTest extends TestCase
{
    public function testTheLastActivityIsWrittenAtMostOncePerPeriod(): void
    {
        $user = new User('claire@acme.test');
        $first = new \DateTimeImmutable('2026-11-03 10:00:00');

        self::assertTrue($user->markSeen($first));
        self::assertFalse($user->markSeen($first->modify(\sprintf('+%d seconds', User::SEEN_PRECISION - 1))));
        self::assertSame($first, $user->getLastSeenAt());

        $later = $first->modify(\sprintf('+%d seconds', User::SEEN_PRECISION));
        self::assertTrue($user->markSeen($later));
        self::assertSame($later, $user->getLastSeenAt());
    }
}
