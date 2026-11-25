<?php

namespace App\Entity;

use App\Repository\LessonCompletionRepository;
use App\Tenant\OrganizationOwnedInterface;
use App\Tenant\OrganizationOwnedTrait;
use Doctrine\ORM\Mapping as ORM;

/**
 * A lesson of the training catalog that a user has marked as done (US-13).
 * Courses and lessons live in the catalog file (TrainingCatalog): only
 * their ids are stored. Personal progress: deleted with the user, part of
 * their data export (US-04).
 */
#[ORM\Entity(repositoryClass: LessonCompletionRepository::class)]
#[ORM\Table(name: 'lesson_completion')]
#[ORM\UniqueConstraint(name: 'uniq_lesson_completion', columns: ['user_id', 'course_id', 'lesson_id'])]
class LessonCompletion implements OrganizationOwnedInterface
{
    use OrganizationOwnedTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(length: 64)]
    private string $courseId;

    #[ORM\Column(length: 64)]
    private string $lessonId;

    #[ORM\Column]
    private \DateTimeImmutable $completedAt;

    public function __construct(User $user, string $courseId, string $lessonId)
    {
        $organization = $user->getOrganization();
        \assert(null !== $organization);
        $this->setOrganization($organization);
        $this->user = $user;
        $this->courseId = $courseId;
        $this->lessonId = $lessonId;
        $this->completedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getCourseId(): string
    {
        return $this->courseId;
    }

    public function getLessonId(): string
    {
        return $this->lessonId;
    }

    public function getCompletedAt(): \DateTimeImmutable
    {
        return $this->completedAt;
    }
}
