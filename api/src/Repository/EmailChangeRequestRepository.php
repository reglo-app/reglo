<?php

namespace App\Repository;

use App\Entity\EmailChangeRequest;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<EmailChangeRequest>
 */
class EmailChangeRequestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EmailChangeRequest::class);
    }

    public function findOneByTokenHash(string $tokenHash): ?EmailChangeRequest
    {
        return $this->findOneBy(['tokenHash' => $tokenHash]);
    }

    public function findLatestForUser(User $user): ?EmailChangeRequest
    {
        return $this->findOneBy(['user' => $user], ['createdAt' => 'DESC', 'id' => 'DESC']);
    }

    public function deleteAllForUser(User $user): void
    {
        $this->createQueryBuilder('r')
            ->delete()
            ->where('r.user = :user')
            ->setParameter('user', $user)
            ->getQuery()
            ->execute();
    }
}
