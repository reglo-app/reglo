<?php

namespace App\Tenant;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Turns OrganizationFilter on for every HTTP request, right after the
 * firewall (priority 8) has authenticated the user and before any data is
 * read. Console commands are not filtered.
 */
#[AsEventListener(event: KernelEvents::REQUEST, priority: 5)]
final class EnableOrganizationFilterListener
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly CurrentOrganization $currentOrganization,
    ) {
    }

    public function __invoke(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $filter = $this->entityManager->getFilters()->enable(OrganizationFilter::NAME);
        $organizationId = $this->currentOrganization->get()?->getId();

        if (null !== $organizationId) {
            $filter->setParameter(OrganizationFilter::PARAMETER, $organizationId, Types::INTEGER);
        }
    }
}
