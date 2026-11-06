<?php

namespace App\Platform;

use App\Entity\Organization;
use App\Storage\AvatarStorage;
use App\Storage\DocumentStorage;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Deletes an organization for good. The database removes its accounts and
 * data in cascade; the files on disk are removed here.
 */
final class OrganizationEraser
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly DocumentStorage $documentStorage,
        private readonly AvatarStorage $avatarStorage,
    ) {
    }

    public function erase(Organization $organization): void
    {
        /** @var array{list<string>, list<string>} $files */
        $files = $this->entityManager->wrapInTransaction(function () use ($organization): array {
            // A document added from now on waits for the end of the
            // transaction, then fails: its file is never forgotten here.
            $this->entityManager->lock($organization, LockMode::PESSIMISTIC_WRITE);

            // Native SQL: OrganizationFilter hides documents from the REGLO
            // team, who belong to no organization.
            $connection = $this->entityManager->getConnection();
            $parameters = ['organization' => $organization->getId()];
            $documents = $connection->fetchFirstColumn('SELECT stored_name FROM document WHERE organization_id = :organization', $parameters);
            $avatars = $connection->fetchFirstColumn('SELECT avatar_file FROM app_user WHERE organization_id = :organization AND avatar_file IS NOT NULL', $parameters);

            $this->entityManager->remove($organization);

            return [$documents, $avatars];
        });

        foreach ($files[0] as $storedName) {
            $this->documentStorage->delete($storedName);
        }
        foreach ($files[1] as $fileName) {
            $this->avatarStorage->delete($fileName);
        }
    }
}
