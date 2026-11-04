<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261104082211 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Store the score of submitted diagnostics (US-06)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE diagnostic ADD score JSON DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE diagnostic DROP score');
    }
}
