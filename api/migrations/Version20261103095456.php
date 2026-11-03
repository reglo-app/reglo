<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261103095456 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add the role given by an invitation (US-16)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE invitation ADD role VARCHAR(16) DEFAULT \'member\' NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE invitation DROP role');
    }
}
