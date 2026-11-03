<?php

namespace App\Entity;

enum DiagnosticStatus: string
{
    /** Being answered by the members of the organization. */
    case Draft = 'draft';
    /** Validated: no longer changed, used for the score (US-06). */
    case Submitted = 'submitted';
}
