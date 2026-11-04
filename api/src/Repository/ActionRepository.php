<?php

namespace App\Repository;

use App\Entity\Action;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
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
     * Soonest due first, with their assignee.
     *
     * @return list<Action>
     */
    public function findAllByDueDate(): array
    {
        return $this->createQueryBuilder('a')
            ->leftJoin('a.assignee', 'u')
            ->addSelect('u')
            ->orderBy('a.dueDate', 'ASC')
            ->addOrderBy('a.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
