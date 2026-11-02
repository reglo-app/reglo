<?php

namespace App\Repository;

use App\Entity\ActivationToken;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ActivationToken>
 */
class ActivationTokenRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ActivationToken::class);
    }

    public function findOneByTokenHash(string $tokenHash): ?ActivationToken
    {
        return $this->findOneBy(['tokenHash' => $tokenHash]);
    }

    public function findLatestForUser(User $user): ?ActivationToken
    {
        return $this->findOneBy(['user' => $user], ['createdAt' => 'DESC', 'id' => 'DESC']);
    }

    public function deleteAllForUser(User $user): void
    {
        $this->createQueryBuilder('t')
            ->delete()
            ->where('t.user = :user')
            ->setParameter('user', $user)
            ->getQuery()
            ->execute();
    }
}
