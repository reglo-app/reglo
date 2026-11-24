<?php

namespace App\Entity;

/**
 * How a document was opened (see DocumentAccess): saved as a file, or shown
 * in the pages of the app (PDF and images).
 */
enum DocumentAccessKind: string
{
    case Download = 'download';
    case View = 'view';
}
