<?php

namespace App\Repository;

use App\Entity\LessonCompletion;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Lessons done by users, filtered by the organization of the logged-in
 * user (OrganizationFilter).
 *
 * @extends ServiceEntityRepository<LessonCompletion>
 */
class LessonCompletionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LessonCompletion::class);
    }

    public function findOne(User $user, string $courseId, string $lessonId): ?LessonCompletion
    {
        return $this->findOneBy(['user' => $user, 'courseId' => $courseId, 'lessonId' => $lessonId]);
    }

    /**
     * Ids of the lessons the user has done, by course id.
     *
     * @return array<string, list<string>>
     */
    public function lessonIdsByCourse(User $user): array
    {
        $rows = $this->createQueryBuilder('c')
            ->select('c.courseId', 'c.lessonId')
            ->where('c.user = :user')
            ->setParameter('user', $user)
            ->getQuery()
            ->getArrayResult();

        $lessonIds = [];
        foreach ($rows as $row) {
            $lessonIds[(string) $row['courseId']][] = (string) $row['lessonId'];
        }

        return $lessonIds;
    }
}
