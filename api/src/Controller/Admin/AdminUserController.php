<?php

namespace App\Controller\Admin;

use App\Account\OrganizationMembers;
use App\Controller\JsonBody;
use App\Entity\AdminAction;
use App\Entity\OrganizationRole;
use App\Entity\User;
use App\Platform\AccountProvisioner;
use App\Platform\AdminAuditLog;
use App\Repository\UserRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Back office: the accounts of the clients (/users) and of the REGLO team
 * (/team), for the REGLO team only. Nobody chooses a password for someone
 * else: every new account gets an activation link.
 */
#[Route('/api/admin', name: 'admin_')]
#[IsGranted(User::ROLE_PLATFORM_ADMIN)]
final class AdminUserController
{
    private const NOT_FOUND = 'Ce compte n\'existe plus.';

    public function __construct(
        private readonly UserRepository $users,
        private readonly OrganizationMembers $members,
        private readonly AccountProvisioner $provisioner,
        private readonly AdminAuditLog $auditLog,
    ) {
    }

    #[Route('/users', name: 'user_list', methods: ['GET'])]
    public function listUsers(): JsonResponse
    {
        return new JsonResponse(array_map(AdminResponse::user(...), $this->users->findClientAccounts()));
    }

    /**
     * Body: {"role": "admin" | "member" | "reader"}.
     */
    #[Route('/users/{id}', name: 'user_update', requirements: ['id' => '\d+'], methods: ['PATCH'])]
    public function updateUser(int $id, Request $request, #[CurrentUser] User $actor): JsonResponse
    {
        $user = $this->findClientAccount($id);
        if (null === $user) {
            return AdminResponse::notFound(self::NOT_FOUND);
        }
        if (null === $user->getOrganization()) {
            return AdminResponse::error('Ce compte n\'appartient à aucune organisation : il n\'a pas de rôle à changer.', 'no_organization');
        }

        $role = OrganizationRole::tryFrom(JsonBody::string($request, 'role'));
        if (null === $role) {
            return AdminResponse::error(AdminResponse::INVALID_ROLE, 'invalid_role');
        }

        if (!$this->members->changeRole($user, $role)) {
            return AdminResponse::error(AdminResponse::LAST_ADMIN, 'last_admin');
        }
        $this->auditLog->record($actor, AdminAction::UserRoleChanged, $user->getEmail().' -> '.$role->value);

        return new JsonResponse(AdminResponse::user($user));
    }

    #[Route('/users/{id}', name: 'user_remove', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function removeUser(int $id, #[CurrentUser] User $actor): Response
    {
        $user = $this->findClientAccount($id);
        if (null === $user) {
            return AdminResponse::notFound(self::NOT_FOUND);
        }

        $email = $user->getEmail();
        if (!$this->members->remove($user)) {
            return AdminResponse::error(AdminResponse::LAST_ADMIN, 'last_admin');
        }
        $this->auditLog->record($actor, AdminAction::UserRemoved, $email);

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * A new link, for a client account or a member of the team. The previous
     * one stops working.
     */
    #[Route('/users/{id}/resend-activation', name: 'user_resend_activation', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function resendActivation(int $id, #[CurrentUser] User $actor): JsonResponse
    {
        $user = $this->users->find($id);
        if (null === $user) {
            return AdminResponse::notFound(self::NOT_FOUND);
        }
        if ($user->isActivated()) {
            return AdminResponse::error('Ce compte est déjà activé.', 'already_activated');
        }

        $emailSent = $this->provisioner->sendActivation($user);
        if ($emailSent) {
            $this->auditLog->record($actor, AdminAction::ActivationResent, $user->getEmail());
        }

        return new JsonResponse(['emailSent' => $emailSent]);
    }

    #[Route('/team', name: 'team_list', methods: ['GET'])]
    public function listTeam(): JsonResponse
    {
        return new JsonResponse(array_map(AdminResponse::user(...), $this->users->findPlatformAdmins()));
    }

    /**
     * Body: email, firstName, lastName. They receive the activation e-mail.
     */
    #[Route('/team', name: 'team_invite', methods: ['POST'])]
    public function inviteTeamMember(Request $request, #[CurrentUser] User $actor): JsonResponse
    {
        $email = JsonBody::string($request, 'email');
        $firstName = JsonBody::string($request, 'firstName');
        $lastName = JsonBody::string($request, 'lastName');

        $errors = $this->provisioner->personErrors($email, $firstName, $lastName);
        if ([] !== $errors) {
            return AdminResponse::invalidFields($errors);
        }

        $user = $this->provisioner->createPlatformAdmin($email, $firstName, $lastName);
        $this->auditLog->record($actor, AdminAction::TeamMemberInvited, $user->getEmail());
        $emailSent = $this->provisioner->sendActivation($user);

        return new JsonResponse(AdminResponse::user($user) + ['emailSent' => $emailSent], Response::HTTP_CREATED);
    }

    /**
     * Nobody removes themself: the team always keeps someone to manage it.
     */
    #[Route('/team/{id}', name: 'team_remove', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function removeTeamMember(int $id, #[CurrentUser] User $actor): Response
    {
        $user = $this->users->find($id);
        if (null === $user || !$user->isPlatformAdmin()) {
            return AdminResponse::notFound(self::NOT_FOUND);
        }
        if ($user->getId() === $actor->getId()) {
            return AdminResponse::error('Vous ne pouvez pas retirer votre propre compte.', 'cannot_remove_self');
        }

        $email = $user->getEmail();
        $this->members->remove($user);
        $this->auditLog->record($actor, AdminAction::TeamMemberRemoved, $email);

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * Any account except the REGLO team, who are managed on /team.
     */
    private function findClientAccount(int $id): ?User
    {
        $user = $this->users->find($id);

        return null === $user || $user->isPlatformAdmin() ? null : $user;
    }
}
