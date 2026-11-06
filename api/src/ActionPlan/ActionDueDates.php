<?php

namespace App\ActionPlan;

use App\Entity\Action;
use App\Entity\ActionStatus;
use Symfony\Component\Clock\ClockInterface;

/**
 * The due dates of the actions against today (US-10). A finished action is
 * neither late nor due soon.
 */
final class ActionDueDates
{
    /** "Due soon": the due date is at most this many days away. */
    public const DUE_SOON_DAYS = 7;

    /** "Today" for the due dates: the users are in France. */
    private const TIMEZONE = 'Europe/Paris';

    public function __construct(private readonly ClockInterface $clock)
    {
    }

    /**
     * Today's date in France, at midnight like the due dates.
     */
    public function today(): \DateTimeImmutable
    {
        $now = $this->clock->now()->setTimezone(new \DateTimeZone(self::TIMEZONE));

        return new \DateTimeImmutable($now->format('Y-m-d'));
    }

    /**
     * The last day that counts as "due soon".
     */
    public function dueSoonLimit(): \DateTimeImmutable
    {
        return $this->today()->modify(\sprintf('+%d days', self::DUE_SOON_DAYS));
    }

    public function isOverdue(Action $action): bool
    {
        return ActionStatus::Done !== $action->getStatus()
            && $action->getDueDate()->format('Y-m-d') < $this->today()->format('Y-m-d');
    }

    public function isDueSoon(Action $action): bool
    {
        $dueDate = $action->getDueDate()->format('Y-m-d');

        return ActionStatus::Done !== $action->getStatus()
            && $dueDate >= $this->today()->format('Y-m-d')
            && $dueDate <= $this->dueSoonLimit()->format('Y-m-d');
    }
}
