<?php

namespace App\Tests;

use Doctrine\ORM\EntityManagerInterface;

/**
 * Empties the tables used by a test so that each test starts from a known state.
 */
trait DatabaseResetTrait
{
    protected static function resetDatabase(EntityManagerInterface $entityManager): void
    {
        $entityManager->getConnection()->executeStatement('TRUNCATE access_token, activation_token, app_user, organization RESTART IDENTITY CASCADE');
        $entityManager->clear();
    }
}
