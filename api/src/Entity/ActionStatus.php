<?php

namespace App\Entity;

/**
 * Steps of an action (US-09), in order. An action moves one step at a time,
 * forward or back (see canMoveTo()).
 */
enum ActionStatus: string
{
    case Todo = 'todo';
    case InProgress = 'in_progress';
    case InReview = 'in_review';
    case Done = 'done';

    public function canMoveTo(self $status): bool
    {
        $cases = self::cases();

        return 1 === abs((int) array_search($this, $cases, true) - (int) array_search($status, $cases, true));
    }
}
