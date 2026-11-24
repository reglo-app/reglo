<?php

namespace App\Repository;

use App\Entity\Document;
use App\Entity\QhsePillar;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Documents of the organization of the logged-in user (OrganizationFilter).
 *
 * @extends ServiceEntityRepository<Document>
 */
class DocumentRepository extends ServiceEntityRepository
{
    /** Types found at the upload, by format shown to users. */
    public const FORMATS = [
        'pdf' => ['application/pdf'],
        'image' => ['image/png', 'image/jpeg'],
        'spreadsheet' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
    ];

    public const SORTS = ['recent', 'oldest', 'name'];

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Document::class);
    }

    /**
     * Documents matching every filter given (US-12), with who uploaded them
     * and what they prove.
     *
     * @param string|null $search part of the name, whatever the case
     * @param string|null $format key of FORMATS
     * @param string      $sort   one of SORTS
     *
     * @return list<Document>
     */
    public function findFiltered(
        ?string $search = null,
        ?string $format = null,
        ?QhsePillar $pillar = null,
        ?int $authorId = null,
        ?\DateTimeImmutable $since = null,
        string $sort = 'recent',
    ): array {
        $query = $this->createQueryBuilder('d')
            ->leftJoin('d.uploadedBy', 'u')
            ->addSelect('u')
            ->leftJoin('d.actions', 'a')
            ->addSelect('a')
            ->leftJoin('d.questionLinks', 'q')
            ->addSelect('q');

        if (null !== $search && '' !== $search) {
            $query->andWhere('LOWER(d.originalName) LIKE :search')
                ->setParameter('search', '%'.addcslashes(mb_strtolower($search), '%_\\').'%');
        }
        if (null !== $format) {
            $query->andWhere('d.mimeType IN (:types)')->setParameter('types', self::FORMATS[$format]);
        }
        if (null !== $pillar) {
            $query->andWhere('d.pillar = :pillar')->setParameter('pillar', $pillar);
        }
        if (null !== $authorId) {
            $query->andWhere('u.id = :author')->setParameter('author', $authorId);
        }
        if (null !== $since) {
            $query->andWhere('d.createdAt >= :since')->setParameter('since', $since);
        }

        match ($sort) {
            'oldest' => $query->orderBy('d.createdAt', 'ASC')->addOrderBy('d.id', 'ASC'),
            'name' => $query->addSelect('LOWER(d.originalName) AS HIDDEN sortName')->orderBy('sortName', 'ASC')->addOrderBy('d.id', 'ASC'),
            default => $query->orderBy('d.createdAt', 'DESC')->addOrderBy('d.id', 'DESC'),
        };

        return $query->getQuery()->getResult();
    }
}
