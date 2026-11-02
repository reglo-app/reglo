<?php

namespace App\Tenant;

use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query\Filter\SQLFilter;

/**
 * Adds "organization = current organization" to every ORM query on an
 * OrganizationOwnedInterface entity: API Platform providers, repositories,
 * find(), lazy-loaded relations. Enabled on each HTTP request by
 * EnableOrganizationFilterListener. Native SQL is not filtered.
 */
final class OrganizationFilter extends SQLFilter
{
    public const NAME = 'organization';
    public const PARAMETER = 'organization_id';

    public function addFilterConstraint(ClassMetadata $targetEntity, string $targetTableAlias): string
    {
        if (!is_a($targetEntity->getName(), OrganizationOwnedInterface::class, true)) {
            return '';
        }

        // No organization (platform administrator, anonymous request):
        // fail closed, nothing is visible.
        if (!$this->hasParameter(self::PARAMETER)) {
            return '1 = 0';
        }

        return \sprintf(
            '%s.%s = %s',
            $targetTableAlias,
            $targetEntity->getSingleAssociationJoinColumnName('organization'),
            $this->getParameter(self::PARAMETER),
        );
    }
}
