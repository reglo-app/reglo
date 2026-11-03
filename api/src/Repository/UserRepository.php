<?php

namespace App\Repository;

use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bridge\Doctrine\Security\User\UserLoaderInterface;

/**
 * @extends ServiceEntityRepository<User>
 */
class UserRepository extends ServiceEntityRepository implements UserLoaderInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }

    public function findOneByEmail(string $email): ?User
    {
        return $this->findOneBy(['email' => User::normalizeEmail($email)]);
    }

    /**
     * Users of one organization, by name. User is not filtered by
     * OrganizationFilter (it is loaded to log in): the organization is
     * always given here.
     *
     * @return list<User>
     */
    public function findMembersOf(Organization $organization): array
    {
        return $this->createQueryBuilder('u')
            ->where('u.organization = :organization')
            ->setParameter('organization', $organization)
            ->orderBy('u.lastName', 'ASC')
            ->addOrderBy('u.firstName', 'ASC')
            ->addOrderBy('u.email', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Administrators of one organization (the rule "at least one
     * administrator" of US-16).
     */
    public function countAdminsOf(Organization $organization): int
    {
        $admins = array_filter(
            $this->findMembersOf($organization),
            static fn (User $user): bool => OrganizationRole::Admin === $user->getOrganizationRole(),
        );

        return \count($admins);
    }

    /**
     * Used by the security user provider: the e-mail is normalized so that
     * login does not depend on the case typed by the user.
     */
    public function loadUserByIdentifier(string $identifier): ?User
    {
        return $this->findOneByEmail($identifier);
    }
}
