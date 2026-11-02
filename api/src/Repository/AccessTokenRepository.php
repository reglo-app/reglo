<?php

namespace App\Repository;

use App\Entity\AccessToken;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AccessToken>
 */
class AccessTokenRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AccessToken::class);
    }

    public function findOneByTokenHash(string $tokenHash): ?AccessToken
    {
        return $this->findOneBy(['tokenHash' => $tokenHash]);
    }

    public function deleteAllForUser(User $user, ?string $exceptTokenHash = null): void
    {
        $query = $this->createQueryBuilder('t')
            ->delete()
            ->where('t.user = :user')
            ->setParameter('user', $user);

        if (null !== $exceptTokenHash) {
            $query->andWhere('t.tokenHash <> :except')->setParameter('except', $exceptTokenHash);
        }

        $query->getQuery()->execute();
    }
}
