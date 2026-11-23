<?php

namespace App\Repository;

use App\Entity\Document;
use App\Entity\DocumentAccess;
use App\Entity\DocumentAccessKind;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Access log of the documents (US-12), filtered by the organization of the
 * logged-in user (OrganizationFilter).
 *
 * @extends ServiceEntityRepository<DocumentAccess>
 */
class DocumentAccessRepository extends ServiceEntityRepository
{
    /**
     * A PDF viewer may load the same file several times in a row: one line
     * per person, document and kind within this delay.
     */
    private const SAME_ACCESS_SECONDS = 60;

    /** Lines shown for one document. */
    public const LIST_LIMIT = 100;

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DocumentAccess::class);
    }

    public function record(Document $document, User $user, DocumentAccessKind $kind): void
    {
        $recent = $this->createQueryBuilder('a')
            ->select('COUNT(a.id)')
            ->where('a.document = :document')
            ->andWhere('a.accessedBy = :user')
            ->andWhere('a.kind = :kind')
            ->andWhere('a.accessedAt > :since')
            ->setParameter('document', $document)
            ->setParameter('user', $user)
            ->setParameter('kind', $kind)
            ->setParameter('since', new \DateTimeImmutable(\sprintf('-%d seconds', self::SAME_ACCESS_SECONDS)))
            ->getQuery()
            ->getSingleScalarResult();

        if ((int) $recent > 0) {
            return;
        }

        $this->getEntityManager()->persist(new DocumentAccess($document, $user, $kind));
        $this->getEntityManager()->flush();
    }

    /**
     * Latest first, with who opened the document.
     *
     * @return list<DocumentAccess>
     */
    public function findForDocument(Document $document): array
    {
        return $this->createQueryBuilder('a')
            ->leftJoin('a.accessedBy', 'u')
            ->addSelect('u')
            ->where('a.document = :document')
            ->setParameter('document', $document)
            ->orderBy('a.accessedAt', 'DESC')
            ->addOrderBy('a.id', 'DESC')
            ->setMaxResults(self::LIST_LIMIT)
            ->getQuery()
            ->getResult();
    }
}
