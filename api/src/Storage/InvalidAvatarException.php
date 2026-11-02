<?php

namespace App\Storage;

/**
 * The uploaded file cannot be a profile photo. The code tells why.
 */
final class InvalidAvatarException extends \RuntimeException
{
    public const TOO_LARGE = 'too_large';
    public const INVALID_IMAGE = 'invalid_image';

    public function __construct(
        public readonly string $reason,
    ) {
        parent::__construct(\sprintf('Invalid profile photo: %s.', $reason));
    }
}
