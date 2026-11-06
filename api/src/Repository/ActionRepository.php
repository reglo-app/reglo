<?php

namespace App\Repository;

use App\ActionPlan\ActionDueFilter;
use App\Entity\Action;
use App\Entity\ActionStatus;
use App\Entity\ActionType;
use App\Entity\QhsePillar;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Actions of the organization of the logged-in user (OrganizationFilter).
 *
 * @extends ServiceEntityRepository<Action>
 */
class ActionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Action::class);
    }

    /**
     * With their assignee, soonest due first (or latest). A null filter does
     * not filter.
     *
     * @return list<Action>
     */
    public function findFiltered(
        ?ActionStatus $status,
        ?QhsePillar $pillar,
        ?ActionType $type,
        ?int $assigneeId,
        ?ActionDueFilter $due,
        \DateTimeImmutable $today,
        \DateTimeImmutable $dueSoonLimit,
        bool $latestFirst = false,
    ): array {
        $query = $this->createQueryBuilder('a')
            ->leftJoin('a.assignee', 'u')
            ->addSelect('u')
            ->orderBy('a.dueDate', $latestFirst ? 'DESC' : 'ASC')
            ->addOrderBy('a.id', 'ASC');

        if (null !== $status) {
            $query->andWhere('a.status = :status')->setParameter('status', $status);
        }
        if (null !== $pillar) {
            $query->andWhere('a.pillar = :pillar')->setParameter('pillar', $pillar);
        }
        if (null !== $type) {
            $query->andWhere('a.type = :type')->setParameter('type', $type);
        }
        if (null !== $assigneeId) {
            $query->andWhere('u.id = :assignee')->setParameter('assignee', $assigneeId);
        }
        if (null !== $due) {
            $query->andWhere('a.status != :done')->setParameter('done', ActionStatus::Done);
            match ($due) {
                ActionDueFilter::Overdue => $query->andWhere('a.dueDate < :today'),
                ActionDueFilter::DueSoon => $query->andWhere('a.dueDate >= :today AND a.dueDate <= :limit')->setParameter('limit', $dueSoonLimit, Types::DATE_IMMUTABLE),
                ActionDueFilter::Upcoming => $query->andWhere('a.dueDate >= :today'),
            };
            $query->setParameter('today', $today, Types::DATE_IMMUTABLE);
        }

        return $query->getQuery()->getResult();
    }

    /**
     * Across every organization (for the daily reminders, no logged-in user):
     * the unfinished actions late or due soon of the assignees who did not
     * get their e-mail today, grouped by assignee, soonest due first.
     *
     * @return list<Action>
     */
    public function findToRemind(\DateTimeImmutable $today, \DateTimeImmutable $dueSoonLimit): array
    {
        return $this->createQueryBuilder('a')
            ->innerJoin('a.assignee', 'u')
            ->addSelect('u')
            ->andWhere('a.status != :done')
            ->andWhere('a.dueDate <= :limit')
            // An action only ever goes to someone of its organization.
            ->andWhere('u.organization = a.organization')
            ->andWhere('u.activatedAt IS NOT NULL')
            ->andWhere('u.actionRemindersSentOn IS NULL OR u.actionRemindersSentOn < :today')
            ->setParameter('done', ActionStatus::Done)
            ->setParameter('limit', $dueSoonLimit, Types::DATE_IMMUTABLE)
            ->setParameter('today', $today, Types::DATE_IMMUTABLE)
            ->orderBy('u.id', 'ASC')
            ->addOrderBy('a.dueDate', 'ASC')
            ->addOrderBy('a.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
