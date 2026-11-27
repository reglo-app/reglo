<?php

namespace App\Tests\Training;

use App\Training\TrainingCatalog;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * US-13. The catalog is a file the REGLO team edits without coding: these
 * tests check the real file, and that a broken one is refused.
 */
final class TrainingCatalogTest extends TestCase
{
    private const REAL_FILE = __DIR__.'/../../config/trainings/catalog.json';

    /** @var list<string> */
    private array $files = [];

    protected function tearDown(): void
    {
        array_map(unlink(...), $this->files);
    }

    public function testTheRealCatalogIsValid(): void
    {
        $courses = (new TrainingCatalog(self::REAL_FILE))->courses();

        self::assertNotEmpty($courses);
        self::assertContains(true, array_column($courses, 'free'), 'At least one free course.');
        foreach ($courses as $course) {
            self::assertContains($course['domain'], ['quality', 'hygiene', 'safety', 'environment']);
        }
    }

    public function testCoursesAndLessonsAreFoundByTheirIds(): void
    {
        $catalog = new TrainingCatalog(__DIR__.'/../Fixtures/trainings.json');

        self::assertSame(['quality-basics', 'safety-basics', 'hygiene-advanced'], array_column($catalog->courses(), 'id'));
        self::assertSame('Video lesson', $catalog->lesson('quality-basics', 'video')['title'] ?? null);
        self::assertSame(['Transcript paragraph.'], $catalog->lesson('quality-basics', 'video')['transcript'] ?? null);
        self::assertNull($catalog->course('unknown'));
        self::assertNull($catalog->lesson('quality-basics', 'unknown'));
        self::assertNull($catalog->lesson('unknown', 'intro'));
    }

    /**
     * @return iterable<string, array{array<string, mixed>, string}>
     */
    public static function invalidLessons(): iterable
    {
        $text = ['id' => 'a', 'title' => 'A', 'type' => 'text', 'durationMinutes' => 5, 'paragraphs' => ['Text.']];

        yield 'unknown type' => [['type' => 'audio'] + $text, '"type"'];
        yield 'no duration' => [array_diff_key($text, ['durationMinutes' => 1]), '"durationMinutes"'];
        yield 'text without paragraphs' => [['paragraphs' => []] + $text, '"paragraphs"'];
        yield 'id with capitals' => [['id' => 'Lesson'] + $text, '"id"'];
        yield 'video without transcript' => [['type' => 'video', 'videoUrl' => 'https://www.youtube-nocookie.com/embed/x'] + $text, '"transcript"'];
        yield 'video with tracking host' => [['type' => 'video', 'videoUrl' => 'https://www.youtube.com/embed/x', 'transcript' => ['T.']] + $text, '"videoUrl"'];
        yield 'pdf over http' => [['type' => 'pdf', 'pdfUrl' => 'http://example.com/a.pdf'] + $text, '"pdfUrl"'];
    }

    /**
     * @param array<string, mixed> $lesson
     */
    #[DataProvider('invalidLessons')]
    public function testAnInvalidLessonIsRefused(array $lesson, string $field): void
    {
        $catalog = $this->catalog([self::course(['lessons' => [$lesson]])]);

        $this->expectException(\UnexpectedValueException::class);
        $this->expectExceptionMessage($field);
        $catalog->courses();
    }

    /**
     * @return iterable<string, array{list<array<string, mixed>>, string}>
     */
    public static function invalidCourses(): iterable
    {
        yield 'unknown domain' => [[self::course(['domain' => 'rse'])], '"domain"'];
        yield 'unknown level' => [[self::course(['level' => 'expert'])], '"level"'];
        yield 'free not a boolean' => [[self::course(['free' => 'yes'])], '"free"'];
        yield 'no lessons' => [[self::course(['lessons' => []])], '"lessons"'];
        yield 'empty title' => [[self::course(['title' => ' '])], '"title"'];
        yield 'same course twice' => [[self::course(), self::course()], 'used twice'];
        yield 'same lesson twice' => [[self::course(['lessons' => [self::lesson(), self::lesson()]])], 'used twice'];
    }

    /**
     * @param list<array<string, mixed>> $courses
     */
    #[DataProvider('invalidCourses')]
    public function testAnInvalidCourseIsRefused(array $courses, string $reason): void
    {
        $catalog = $this->catalog($courses);

        $this->expectException(\UnexpectedValueException::class);
        $this->expectExceptionMessage($reason);
        $catalog->courses();
    }

    /**
     * @param array<string, mixed> $changes
     *
     * @return array<string, mixed>
     */
    private static function course(array $changes = []): array
    {
        return $changes + [
            'id' => 'course',
            'title' => 'Course',
            'summary' => 'Summary.',
            'domain' => 'quality',
            'level' => 'beginner',
            'free' => true,
            'lessons' => [self::lesson()],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function lesson(): array
    {
        return ['id' => 'lesson', 'title' => 'Lesson', 'type' => 'text', 'durationMinutes' => 5, 'paragraphs' => ['Text.']];
    }

    /**
     * @param list<array<string, mixed>> $courses
     */
    private function catalog(array $courses): TrainingCatalog
    {
        $file = (string) tempnam(sys_get_temp_dir(), 'catalog');
        file_put_contents($file, json_encode(['courses' => $courses], \JSON_THROW_ON_ERROR));
        $this->files[] = $file;

        return new TrainingCatalog($file);
    }
}
