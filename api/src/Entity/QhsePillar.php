<?php

namespace App\Entity;

/** The four QHSE pillars (rule 7), with their technical keys. */
enum QhsePillar: string
{
    case Quality = 'quality';
    case Hygiene = 'hygiene';
    case Safety = 'safety';
    case Environment = 'environment';

    /** Same words as the web app (web/src/lib/domains.ts). */
    public function label(): string
    {
        return match ($this) {
            self::Quality => 'Qualité',
            self::Hygiene => 'Hygiène-Santé',
            self::Safety => 'Sécurité',
            self::Environment => 'Environnement',
        };
    }
}
