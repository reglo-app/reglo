<?php

namespace App\Repository;

use App\Entity\Document;
use App\Entity\Organization;
use App\Entity\QuestionDocument;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Links between documents and questions of the diagnostic, filtered by the
 * organization of the logged-in user (OrganizationFilter).
 *
 * @extends ServiceEntityRepository<QuestionDocument>
 */
class QuestionDocumentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, QuestionDocument::class);
    }

    public function findLink(Document $document, string $questionId): ?QuestionDocument
    {
        return $this->findOneBy(['document' => $document, 'questionId' => $questionId]);
    }

    /**
     * Questions of the organization that have at least one document: sent
     * to the score computation.
     *
     * @return list<string>
     */
    public function questionIdsWithDocument(Organization $organization): array
    {
        $rows = $this->createQueryBuilder('q')
            ->select('DISTINCT q.questionId')
            ->where('q.organization = :organization')
            ->setParameter('organization', $organization)
            ->getQuery()
            ->getSingleColumnResult();

        return array_values(array_map(strval(...), $rows));
    }
}
