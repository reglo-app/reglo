<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261103134010 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add the last activity date of users (Équipe page)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user ADD last_seen_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user DROP last_seen_at');
    }
}
