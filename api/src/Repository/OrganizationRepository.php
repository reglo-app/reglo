<?php

namespace App\Repository;

use App\Entity\Organization;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Organization>
 */
class OrganizationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Organization::class);
    }

    /**
     * Case-insensitive: "ACME" and "Acme" are the same organization.
     */
    public function existsWithName(string $name): bool
    {
        $count = $this->createQueryBuilder('o')
            ->select('COUNT(o.id)')
            ->where('LOWER(o.name) = LOWER(:name)')
            ->setParameter('name', Organization::normalizeName($name))
            ->getQuery()
            ->getSingleScalarResult();

        return (int) $count > 0;
    }
}
