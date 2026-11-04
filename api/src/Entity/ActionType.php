<?php

namespace App\Entity;

/** Kind of action of the action plan (US-09). */
enum ActionType: string
{
    /** Fixes a problem found. */
    case Corrective = 'corrective';
    /** Avoids a risk before it happens. */
    case Preventive = 'preventive';
    /** Goes beyond what is required. */
    case Improvement = 'improvement';
}
