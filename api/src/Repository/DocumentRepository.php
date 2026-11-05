<?php

namespace App\Repository;

use App\Entity\Document;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Documents of the organization of the logged-in user (OrganizationFilter).
 *
 * @extends ServiceEntityRepository<Document>
 */
class DocumentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Document::class);
    }

    /**
     * Latest first, with who uploaded them.
     *
     * @return list<Document>
     */
    public function findLatestFirst(): array
    {
        return $this->createQueryBuilder('d')
            ->leftJoin('d.uploadedBy', 'u')
            ->addSelect('u')
            ->orderBy('d.createdAt', 'DESC')
            ->addOrderBy('d.id', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
