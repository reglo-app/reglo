<?php

namespace App\Training;

use App\Entity\QhsePillar;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * The training catalog (US-13), read from a JSON file like the
 * questionnaire: the REGLO team changes the courses by replacing the file,
 * without changing the code. The file is checked when read, so a mistake
 * fails the tests (TrainingCatalogTest) instead of showing a broken course.
 *
 * Format: {"courses": [course]}, where a course is
 * {"id", "title", "summary", "domain" (QHSE key), "level" (beginner,
 * intermediate, advanced), "free" (bool), "lessons": [lesson]} and a lesson
 * {"id", "title", "type", "durationMinutes", "paragraphs", "keyPoints"}:
 * - "text": paragraphs required, keyPoints optional;
 * - "video": "videoUrl" (privacy-friendly embed, see VIDEO_HOSTS) and
 *   "transcript" (list of paragraphs) required;
 * - "pdf": "pdfUrl" (https) required, paragraphs optional.
 * Ids are lowercase letters, digits and dashes; lesson ids are unique within
 * their course.
 */
final class TrainingCatalog
{
    public const LEVELS = ['beginner', 'intermediate', 'advanced'];
    public const LESSON_TYPES = ['text', 'video', 'pdf'];

    /**
     * Embeds that set no tracking cookie before the video is played.
     */
    public const VIDEO_HOSTS = [
        'https://www.youtube-nocookie.com/embed/',
        'https://player.vimeo.com/video/',
    ];

    private const ID_PATTERN = '/^[a-z0-9-]{1,64}$/';

    /** @var array<string, array<string, mixed>>|null courses by id */
    private ?array $courses = null;

    public function __construct(
        #[Autowire(param: 'app.training_catalog_file')]
        private readonly string $file,
    ) {
    }

    /**
     * Every course, in the order of the file.
     *
     * @return list<array<string, mixed>>
     */
    public function courses(): array
    {
        return array_values($this->load());
    }

    /**
     * @return array<string, mixed>|null
     */
    public function course(string $id): ?array
    {
        return $this->load()[$id] ?? null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function lesson(string $courseId, string $lessonId): ?array
    {
        foreach ($this->course($courseId)['lessons'] ?? [] as $lesson) {
            if ($lesson['id'] === $lessonId) {
                return $lesson;
            }
        }

        return null;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function load(): array
    {
        if (null !== $this->courses) {
            return $this->courses;
        }

        $data = json_decode((string) file_get_contents($this->file), true, flags: \JSON_THROW_ON_ERROR);
        if (!\is_array($data) || !\is_array($data['courses'] ?? null) || !array_is_list($data['courses'])) {
            throw $this->invalid('"courses" must be a list');
        }

        $courses = [];
        foreach ($data['courses'] as $index => $course) {
            $course = $this->checkCourse($course, \sprintf('course #%d', $index + 1));
            if (isset($courses[$course['id']])) {
                throw $this->invalid(\sprintf('course id "%s" is used twice', $course['id']));
            }
            $courses[$course['id']] = $course;
        }

        return $this->courses = $courses;
    }

    /**
     * @return array<string, mixed>
     */
    private function checkCourse(mixed $course, string $where): array
    {
        if (!\is_array($course)) {
            throw $this->invalid($where.' must be an object');
        }

        $id = $this->id($course['id'] ?? null, $where);
        $where = \sprintf('course "%s"', $id);
        if (null === QhsePillar::tryFrom((string) ($course['domain'] ?? ''))) {
            throw $this->invalid($where.': "domain" must be quality, hygiene, safety or environment');
        }
        if (!\in_array($course['level'] ?? null, self::LEVELS, true)) {
            throw $this->invalid($where.': "level" must be '.implode(', ', self::LEVELS));
        }
        if (!\is_bool($course['free'] ?? null)) {
            throw $this->invalid($where.': "free" must be true or false');
        }
        if (!\is_array($course['lessons'] ?? null) || !array_is_list($course['lessons']) || [] === $course['lessons']) {
            throw $this->invalid($where.': "lessons" must be a non-empty list');
        }

        $lessons = [];
        foreach ($course['lessons'] as $index => $lesson) {
            $lesson = $this->checkLesson($lesson, \sprintf('%s, lesson #%d', $where, $index + 1));
            if (\in_array($lesson['id'], array_column($lessons, 'id'), true)) {
                throw $this->invalid(\sprintf('%s: lesson id "%s" is used twice', $where, $lesson['id']));
            }
            $lessons[] = $lesson;
        }

        return [
            'id' => $id,
            'title' => $this->text($course['title'] ?? null, $where.': "title"'),
            'summary' => $this->text($course['summary'] ?? null, $where.': "summary"'),
            'domain' => $course['domain'],
            'level' => $course['level'],
            'free' => $course['free'],
            'lessons' => $lessons,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function checkLesson(mixed $lesson, string $where): array
    {
        if (!\is_array($lesson)) {
            throw $this->invalid($where.' must be an object');
        }

        $id = $this->id($lesson['id'] ?? null, $where);
        $where = \sprintf('%s ("%s")', $where, $id);
        $type = $lesson['type'] ?? null;
        if (!\in_array($type, self::LESSON_TYPES, true)) {
            throw $this->invalid($where.': "type" must be '.implode(', ', self::LESSON_TYPES));
        }
        $duration = $lesson['durationMinutes'] ?? null;
        if (!\is_int($duration) || $duration < 1) {
            throw $this->invalid($where.': "durationMinutes" must be a positive number');
        }

        $checked = [
            'id' => $id,
            'title' => $this->text($lesson['title'] ?? null, $where.': "title"'),
            'type' => $type,
            'durationMinutes' => $duration,
            'paragraphs' => $this->texts($lesson['paragraphs'] ?? [], $where.': "paragraphs"', 'text' === $type),
            'keyPoints' => $this->texts($lesson['keyPoints'] ?? [], $where.': "keyPoints"', false),
            'videoUrl' => null,
            'transcript' => [],
            'pdfUrl' => null,
        ];

        if ('video' === $type) {
            $url = $lesson['videoUrl'] ?? null;
            $allowed = \is_string($url) && [] !== array_filter(self::VIDEO_HOSTS, static fn (string $host): bool => str_starts_with($url, $host));
            if (!$allowed) {
                throw $this->invalid($where.': "videoUrl" must start with '.implode(' or ', self::VIDEO_HOSTS));
            }
            $checked['videoUrl'] = $url;
            // Rule 5 (RGAA): every video comes with its text.
            $checked['transcript'] = $this->texts($lesson['transcript'] ?? null, $where.': "transcript"', true);
        }

        if ('pdf' === $type) {
            $url = $lesson['pdfUrl'] ?? null;
            if (!\is_string($url) || !str_starts_with($url, 'https://')) {
                throw $this->invalid($where.': "pdfUrl" must be an https address');
            }
            $checked['pdfUrl'] = $url;
        }

        return $checked;
    }

    private function id(mixed $id, string $where): string
    {
        if (!\is_string($id) || 1 !== preg_match(self::ID_PATTERN, $id)) {
            throw $this->invalid($where.': "id" must use lowercase letters, digits and dashes');
        }

        return $id;
    }

    private function text(mixed $text, string $where): string
    {
        if (!\is_string($text) || '' === trim($text)) {
            throw $this->invalid($where.' must be a non-empty text');
        }

        return $text;
    }

    /**
     * @return list<string>
     */
    private function texts(mixed $texts, string $where, bool $required): array
    {
        if (!\is_array($texts) || !array_is_list($texts) || ($required && [] === $texts)) {
            throw $this->invalid($where.' must be a '.($required ? 'non-empty ' : '').'list of texts');
        }

        return array_map(fn (mixed $text): string => $this->text($text, $where), $texts);
    }

    private function invalid(string $reason): \UnexpectedValueException
    {
        return new \UnexpectedValueException(\sprintf('Invalid training catalog "%s": %s.', $this->file, $reason));
    }
}
