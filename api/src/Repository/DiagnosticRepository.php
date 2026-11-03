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
}
