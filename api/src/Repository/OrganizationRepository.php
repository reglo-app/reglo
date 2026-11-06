<?php

namespace App\Repository;

use App\Entity\Organization;
use App\Entity\User;
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

    /**
     * Every organization, by name, with its number of accounts and how many
     * are waiting for activation. For the back office only.
     *
     * @return list<array{id: int, name: string, createdAt: \DateTimeImmutable, userCount: int, pendingCount: int}>
     */
    public function findAllWithUserCounts(): array
    {
        $rows = $this->createQueryBuilder('o')
            ->select('o.id, o.name, o.createdAt, COUNT(u.id) AS userCount')
            ->addSelect('SUM(CASE WHEN u.id IS NOT NULL AND u.activatedAt IS NULL THEN 1 ELSE 0 END) AS pendingCount')
            ->leftJoin(User::class, 'u', 'WITH', 'u.organization = o')
            ->groupBy('o.id')
            ->orderBy('o.name', 'ASC')
            ->getQuery()
            ->getResult();

        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'createdAt' => $row['createdAt'],
            'userCount' => (int) $row['userCount'],
            'pendingCount' => (int) $row['pendingCount'],
        ], $rows);
    }
}
