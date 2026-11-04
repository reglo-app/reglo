<?php

namespace App\Diagnostic;

/**
 * The score could not be computed (data service down, slow or refusing):
 * the diagnostic stays a draft, the user can try again.
 */
final class ScoreUnavailableException extends \RuntimeException
{
}
