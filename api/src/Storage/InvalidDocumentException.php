<?php

namespace App\Storage;

/**
 * The uploaded file cannot be kept as a document. The code tells why.
 */
final class InvalidDocumentException extends \RuntimeException
{
    public const TOO_LARGE = 'too_large';
    public const INVALID_TYPE = 'invalid_type';
    public const EMPTY_FILE = 'empty_file';
    public const UPLOAD_FAILED = 'upload_failed';

    public function __construct(
        public readonly string $reason,
    ) {
        parent::__construct(\sprintf('Invalid document: %s.', $reason));
    }
}
