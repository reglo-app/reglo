<?php

namespace App\Entity;

/**
 * What a REGLO team member can do in the back office (see AdminAuditEntry).
 */
enum AdminAction: string
{
    case OrganizationCreated = 'organization.created';
    case OrganizationRenamed = 'organization.renamed';
    case OrganizationDeleted = 'organization.deleted';
    case UserCreated = 'user.created';
    case UserRoleChanged = 'user.role_changed';
    case UserRenamed = 'user.renamed';
    case UserRemoved = 'user.removed';
    case ActivationResent = 'user.activation_resent';
    case TeamMemberInvited = 'team.invited';
    case TeamMemberRemoved = 'team.removed';
}
