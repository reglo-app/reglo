<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * US-10: the day of the last daily e-mail about actions, per user.
 */
final class Version20261105160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Keep the day of the last action reminder of each user';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user ADD action_reminders_sent_on DATE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user DROP action_reminders_sent_on');
    }
}
