<?php

namespace App\Repository;

use App\Entity\Invitation;
use App\Tenant\OrganizationFilter;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Invitations are filtered on the organization of the logged-in user
 * (OrganizationFilter), except the lookup by token of the public link.
 *
 * @extends ServiceEntityRepository<Invitation>
 */
class InvitationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Invitation::class);
    }

    /**
     * Pending invitations of the current organization, latest first.
     *
     * @return list<Invitation>
     */
    public function findPending(): array
    {
        return $this->findBy([], ['sentAt' => 'DESC', 'id' => 'DESC']);
    }

    public function findOneByEmail(string $email): ?Invitation
    {
        return $this->findOneBy(['email' => $email]);
    }

    /**
     * The invited person opens the link without being logged in, so no
     * organization is known: the filter is suspended for this lookup only.
     * The secret token is the proof, as for account activation.
     */
    public function findOneByTokenHash(string $tokenHash): ?Invitation
    {
        $filters = $this->getEntityManager()->getFilters();
        $suspended = $filters->isEnabled(OrganizationFilter::NAME);

        if ($suspended) {
            $filters->suspend(OrganizationFilter::NAME);
        }

        try {
            return $this->findOneBy(['tokenHash' => $tokenHash]);
        } finally {
            if ($suspended) {
                $filters->restore(OrganizationFilter::NAME);
            }
        }
    }
}
