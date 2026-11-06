<?php

namespace App\Account;

use App\Entity\OrganizationRole;
use App\Entity\User;
use App\Repository\UserRepository;
use App\Storage\AvatarStorage;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Changes the role of a member or removes them, keeping the rule of US-16:
 * an organization always has at least one administrator. Used by the "Équipe"
 * page and by the back office. Whoever calls it has checked the right to.
 */
final class OrganizationMembers
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly UserRepository $repository,
        private readonly AvatarStorage $avatarStorage,
    ) {
    }

    /**
     * False when the member is the last administrator. Takes effect at their
     * next request: roles are read from the database each time.
     */
    public function changeRole(User $member, OrganizationRole $role): bool
    {
        return $this->entityManager->wrapInTransaction(function () use ($member, $role): bool {
            $this->lockOrganizationOf($member);
            if (OrganizationRole::Admin !== $role && $this->isLastAdmin($member)) {
                return false;
            }

            $member->setOrganizationRole($role);

            return true;
        });
    }

    /**
     * Deletes the account (sessions, links and profile photo included). False
     * when the member is the last administrator.
     */
    public function remove(User $member): bool
    {
        $avatarFile = $member->getAvatarFile();
        $removed = $this->entityManager->wrapInTransaction(function () use ($member): bool {
            $this->lockOrganizationOf($member);
            if ($this->isLastAdmin($member)) {
                return false;
            }

            $this->entityManager->remove($member);

            return true;
        });

        if ($removed && null !== $avatarFile) {
            $this->avatarStorage->delete($avatarFile);
        }

        return $removed;
    }

    /**
     * Two administrators changing each other's role at the same time must
     * not leave the organization without any: the second one waits.
     */
    private function lockOrganizationOf(User $member): void
    {
        $organization = $member->getOrganization();
        if (null !== $organization) {
            $this->entityManager->lock($organization, LockMode::PESSIMISTIC_WRITE);
        }
    }

    private function isLastAdmin(User $member): bool
    {
        $organization = $member->getOrganization();

        return OrganizationRole::Admin === $member->getOrganizationRole()
            && null !== $organization
            && $this->repository->countAdminsOf($organization) <= 1;
    }
}
