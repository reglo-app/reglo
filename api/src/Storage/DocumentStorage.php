<?php

namespace App\Storage;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Evidence documents (rule 4): the real file type is checked on the content
 * and must match the extension, then the file is kept under a random name
 * without extension, outside the public folder. It is only ever sent back
 * as a download, through the authenticated API.
 */
final class DocumentStorage
{
    public const MAX_BYTES = 20 * 1024 * 1024;

    private const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    /** The type kept for each accepted extension. */
    private const TYPES = [
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'xlsx' => self::XLSX,
        'csv' => 'text/csv',
    ];
    /** A CSV file has no signature: it is plain text. */
    private const CSV_CONTENT_TYPES = ['text/csv', 'text/plain', 'application/csv'];
    /** What file detection may answer for a workbook, opened to be sure. */
    private const XLSX_CONTENT_TYPES = [self::XLSX, 'application/zip', 'application/octet-stream'];
    private const STORED_NAME_PATTERN = '/^[0-9a-f]{32}$/';

    public function __construct(
        #[Autowire(param: 'app.documents_dir')]
        private readonly string $documentsDir,
    ) {
    }

    /**
     * @return array{storedName: string, mimeType: string, size: int}
     *
     * @throws InvalidDocumentException
     */
    public function store(UploadedFile $file): array
    {
        if (\in_array($file->getError(), [\UPLOAD_ERR_INI_SIZE, \UPLOAD_ERR_FORM_SIZE], true)) {
            throw new InvalidDocumentException(InvalidDocumentException::TOO_LARGE);
        }
        if (!$file->isValid()) {
            throw new InvalidDocumentException(InvalidDocumentException::UPLOAD_FAILED);
        }

        $size = (int) $file->getSize();
        if ($size > self::MAX_BYTES) {
            throw new InvalidDocumentException(InvalidDocumentException::TOO_LARGE);
        }
        if (0 === $size) {
            throw new InvalidDocumentException(InvalidDocumentException::EMPTY_FILE);
        }

        $mimeType = $this->checkedType($file);
        $storedName = bin2hex(random_bytes(16));
        $file->move($this->directory(), $storedName);

        return ['storedName' => $storedName, 'mimeType' => $mimeType, 'size' => $size];
    }

    public function path(string $storedName): string
    {
        if (1 !== preg_match(self::STORED_NAME_PATTERN, $storedName)) {
            throw new \InvalidArgumentException('Not a stored document.');
        }

        return $this->directory().'/'.$storedName;
    }

    public function delete(string $storedName): void
    {
        $path = $this->path($storedName);

        if (is_file($path)) {
            unlink($path);
        }
    }

    /**
     * The original name as metadata: no path nor control character, and not
     * longer than the column.
     */
    public static function cleanName(string $name, int $maxLength): string
    {
        $clean = trim((string) preg_replace('/[\x00-\x1f\x7f\/\\\\]/u', '_', mb_scrub($name, 'UTF-8')));
        $extension = pathinfo($clean, \PATHINFO_EXTENSION);

        return mb_strlen($clean) <= $maxLength
            ? $clean
            : mb_substr($clean, 0, $maxLength - mb_strlen($extension) - 1).'.'.$extension;
    }

    /**
     * getMimeType() reads the content, not the name or the client header.
     */
    private function checkedType(UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $expected = self::TYPES[$extension] ?? null;
        $found = $file->getMimeType();

        $matches = match ($expected) {
            null => false,
            'text/csv' => \in_array($found, self::CSV_CONTENT_TYPES, true),
            self::XLSX => \in_array($found, self::XLSX_CONTENT_TYPES, true) && self::isWorkbook($file->getPathname()),
            default => $expected === $found,
        };

        if (!$matches || null === $expected) {
            throw new InvalidDocumentException(InvalidDocumentException::INVALID_TYPE);
        }

        return $expected;
    }

    /**
     * A real workbook, without macros (they would be .xlsm). The archive is
     * only listed, never extracted.
     */
    private static function isWorkbook(string $path): bool
    {
        $archive = new \ZipArchive();
        if (true !== $archive->open($path, \ZipArchive::RDONLY)) {
            return false;
        }

        $isWorkbook = false !== $archive->locateName('[Content_Types].xml')
            && false !== $archive->locateName('xl/workbook.xml')
            && false === $archive->locateName('xl/vbaProject.bin');
        $archive->close();

        return $isWorkbook;
    }

    private function directory(): string
    {
        if (!is_dir($this->documentsDir) && !mkdir($this->documentsDir, 0o770, true) && !is_dir($this->documentsDir)) {
            throw new \RuntimeException('The documents folder cannot be created.');
        }

        return $this->documentsDir;
    }
}
