<?php

namespace App\ActionPlan;

/**
 * The due date filter of the action plan (US-10). Finished actions never
 * match: they have nothing left to be late for.
 */
enum ActionDueFilter: string
{
    case Overdue = 'overdue';
    case DueSoon = 'soon';
    case Upcoming = 'upcoming';
}
