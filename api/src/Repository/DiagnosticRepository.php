<?php

namespace App\Repository;

use App\Entity\Diagnostic;
use App\Entity\DiagnosticStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Diagnostics are filtered on the organization of the logged-in user
 * (OrganizationFilter): "the draft" is the one of this organization.
 *
 * @extends ServiceEntityRepository<Diagnostic>
 */
class DiagnosticRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Diagnostic::class);
    }

    public function findDraft(): ?Diagnostic
    {
        return $this->findOneBy(['status' => DiagnosticStatus::Draft]);
    }

    public function findLastSubmitted(): ?Diagnostic
    {
        return $this->findOneBy(['status' => DiagnosticStatus::Submitted], ['submittedAt' => 'DESC', 'id' => 'DESC']);
    }

    /**
     * The submitted diagnostics with a score, latest first: the history,
     * or the latest result with a limit of 1.
     *
     * @return list<Diagnostic>
     */
    public function findScored(?int $limit = null): array
    {
        return $this->createQueryBuilder('d')
            ->where('d.status = :submitted')
            ->andWhere('d.score IS NOT NULL')
            ->setParameter('submitted', DiagnosticStatus::Submitted)
            ->orderBy('d.submittedAt', 'DESC')
            ->addOrderBy('d.id', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * The scored diagnostic submitted just before this one, for the trend.
     */
    public function findScoredBefore(Diagnostic $diagnostic): ?Diagnostic
    {
        return $this->createQueryBuilder('d')
            ->where('d.status = :submitted')
            ->andWhere('d.score IS NOT NULL')
            ->andWhere('(d.submittedAt < :at OR (d.submittedAt = :at AND d.id < :id))')
            ->setParameter('submitted', DiagnosticStatus::Submitted)
            ->setParameter('at', $diagnostic->getSubmittedAt())
            ->setParameter('id', $diagnostic->getId())
            ->orderBy('d.submittedAt', 'DESC')
            ->addOrderBy('d.id', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
