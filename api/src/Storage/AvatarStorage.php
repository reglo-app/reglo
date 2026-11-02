<?php

namespace App\Storage;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Profile photos (rule 4): the real file type is checked, then the image is
 * re-encoded as a small square WebP under a random name, outside the public
 * folder. Re-encoding drops the metadata (GPS position of a phone photo...)
 * and anything else hidden in the file.
 */
final class AvatarStorage
{
    public const MAX_BYTES = 5 * 1024 * 1024;
    /** Side of the stored square, in pixels (shown at 128 px at most). */
    public const SIZE = 256;
    /** Larger images would need too much memory to decode (20 megapixels). */
    private const MAX_PIXELS = 20_000_000;
    private const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    private const FILE_NAME_PATTERN = '/^[0-9a-f]{32}\.webp$/';

    public function __construct(
        #[Autowire(param: 'app.uploads_dir')]
        private readonly string $uploadsDir,
    ) {
    }

    /**
     * @return string the random file name to keep on the user
     *
     * @throws InvalidAvatarException
     */
    public function store(UploadedFile $file): string
    {
        if (\in_array($file->getError(), [\UPLOAD_ERR_INI_SIZE, \UPLOAD_ERR_FORM_SIZE], true)
            || ($file->isValid() && $file->getSize() > self::MAX_BYTES)) {
            throw new InvalidAvatarException(InvalidAvatarException::TOO_LARGE);
        }

        // getMimeType() reads the content, not the name or the client header
        if (!$file->isValid() || !\in_array($file->getMimeType(), self::ALLOWED_TYPES, true)) {
            throw new InvalidAvatarException(InvalidAvatarException::INVALID_IMAGE);
        }

        $size = @getimagesize($file->getPathname());
        if (false === $size || $size[0] < 1 || $size[1] < 1 || $size[0] * $size[1] > self::MAX_PIXELS) {
            throw new InvalidAvatarException(InvalidAvatarException::INVALID_IMAGE);
        }

        $source = @imagecreatefromstring((string) file_get_contents($file->getPathname()));
        if (false === $source) {
            throw new InvalidAvatarException(InvalidAvatarException::INVALID_IMAGE);
        }

        $fileName = bin2hex(random_bytes(16)).'.webp';
        $this->writeSquare($source, $this->path($fileName));

        return $fileName;
    }

    public function path(string $fileName): string
    {
        if (1 !== preg_match(self::FILE_NAME_PATTERN, $fileName)) {
            throw new \InvalidArgumentException('Not a stored profile photo.');
        }

        return $this->directory().'/'.$fileName;
    }

    public function delete(string $fileName): void
    {
        $path = $this->path($fileName);

        if (is_file($path)) {
            unlink($path);
        }
    }

    /**
     * Keeps the centre of the image, like the round frame shown in the app.
     */
    private function writeSquare(\GdImage $source, string $path): void
    {
        $width = imagesx($source);
        $height = imagesy($source);
        $side = min($width, $height);

        $square = imagecreatetruecolor(self::SIZE, self::SIZE);
        // Keeps the transparency of PNG and WebP images
        imagealphablending($square, false);
        imagesavealpha($square, true);
        imagefill($square, 0, 0, (int) imagecolorallocatealpha($square, 0, 0, 0, 127));
        imagecopyresampled(
            $square,
            $source,
            0,
            0,
            intdiv($width - $side, 2),
            intdiv($height - $side, 2),
            self::SIZE,
            self::SIZE,
            $side,
            $side,
        );

        if (!imagewebp($square, $path, 85)) {
            throw new \RuntimeException('The profile photo could not be saved.');
        }
    }

    private function directory(): string
    {
        $directory = $this->uploadsDir.'/avatars';

        if (!is_dir($directory) && !mkdir($directory, 0o770, true) && !is_dir($directory)) {
            throw new \RuntimeException('The uploads folder cannot be created.');
        }

        return $directory;
    }
}
