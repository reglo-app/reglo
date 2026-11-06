<?php

namespace App\Controller\Admin;

use App\Controller\JsonBody;
use App\Entity\AdminAction;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Entity\User;
use App\Platform\AccountProvisioner;
use App\Platform\AdminAuditLog;
use App\Platform\OrganizationEraser;
use App\Repository\OrganizationRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Back office: the client organizations, for the REGLO team only. It manages
 * accesses and never reads the data of a client (diagnostics, actions,
 * documents).
 */
#[Route('/api/admin/organizations', name: 'admin_organization_')]
#[IsGranted(User::ROLE_PLATFORM_ADMIN)]
final class AdminOrganizationController
{
    private const NOT_FOUND = 'Cette organisation n\'existe plus.';

    public function __construct(
        private readonly OrganizationRepository $organizations,
        private readonly UserRepository $users,
        private readonly AccountProvisioner $provisioner,
        private readonly AdminAuditLog $auditLog,
    ) {
    }

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        return new JsonResponse(array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'name' => $row['name'],
            'createdAt' => $row['createdAt']->format(\DATE_ATOM),
            'userCount' => $row['userCount'],
            'pendingCount' => $row['pendingCount'],
        ], $this->organizations->findAllWithUserCounts()));
    }

    /**
     * Body: name, adminEmail, adminFirstName, adminLastName. The first
     * administrator receives the activation e-mail.
     */
    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request, #[CurrentUser] User $actor): JsonResponse
    {
        $name = Organization::normalizeName(JsonBody::string($request, 'name'));
        $email = JsonBody::string($request, 'adminEmail');
        $firstName = JsonBody::string($request, 'adminFirstName');
        $lastName = JsonBody::string($request, 'adminLastName');

        $nameError = $this->provisioner->nameError($name);
        $errors = array_filter(['name' => $nameError]) + $this->provisioner->personErrors($email, $firstName, $lastName);
        if ([] !== $errors) {
            return AdminResponse::invalidFields($errors);
        }

        $admin = $this->provisioner->createOrganization($name, $email, $firstName, $lastName);
        $this->auditLog->record($actor, AdminAction::OrganizationCreated, $name.', '.$admin->getEmail());
        $emailSent = $this->provisioner->sendActivation($admin);

        return new JsonResponse([
            'id' => (string) $admin->getOrganization()?->getId(),
            'name' => $name,
            'adminEmail' => $admin->getEmail(),
            'emailSent' => $emailSent,
        ], Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'show', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function show(int $id): JsonResponse
    {
        $organization = $this->organizations->find($id);
        if (null === $organization) {
            return AdminResponse::notFound(self::NOT_FOUND);
        }

        return new JsonResponse([
            'id' => (string) $organization->getId(),
            'name' => $organization->getName(),
            'createdAt' => $organization->getCreatedAt()->format(\DATE_ATOM),
            'users' => array_map(AdminResponse::user(...), $this->users->findMembersOf($organization)),
        ]);
    }

    /**
     * Body: {"name": "..."}.
     */
    #[Route('/{id}', name: 'rename', requirements: ['id' => '\d+'], methods: ['PATCH'])]
    public function rename(int $id, Request $request, #[CurrentUser] User $actor, EntityManagerInterface $entityManager): Response
    {
        $organization = $this->organizations->find($id);
        if (null === $organization) {
            return AdminResponse::notFound(self::NOT_FOUND);
        }

        $name = Organization::normalizeName(JsonBody::string($request, 'name'));
        $error = $this->provisioner->nameError($name, $organization);
        if (null !== $error) {
            return AdminResponse::invalidFields(['name' => $error]);
        }

        $previous = $organization->getName();
        if ($previous !== $name) {
            $organization->rename($name);
            $entityManager->flush();
            $this->auditLog->record($actor, AdminAction::OrganizationRenamed, $previous.' -> '.$name);
        }

        return new JsonResponse(['id' => (string) $organization->getId(), 'name' => $name]);
    }

    /**
     * Irreversible: accounts, data and files of the organization. Body:
     * {"confirmName": "..."}, the exact name, so that a wrong call deletes
     * nothing, whatever the web app does.
     */
    #[Route('/{id}', name: 'delete', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function delete(int $id, Request $request, #[CurrentUser] User $actor, OrganizationEraser $eraser): Response
    {
        $organization = $this->organizations->find($id);
        if (null === $organization) {
            return AdminResponse::notFound(self::NOT_FOUND);
        }

        $name = $organization->getName();
        if (Organization::normalizeName(JsonBody::string($request, 'confirmName')) !== $name) {
            return AdminResponse::error('Saisissez exactement le nom de l\'organisation pour confirmer.', 'confirmation_mismatch');
        }

        $eraser->erase($organization);
        $this->auditLog->record($actor, AdminAction::OrganizationDeleted, $name);

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * Adds a user directly, with the role chosen. Body: email, firstName,
     * lastName, role. They receive the activation e-mail.
     */
    #[Route('/{id}/users', name: 'add_user', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function addUser(int $id, Request $request, #[CurrentUser] User $actor): JsonResponse
    {
        $organization = $this->organizations->find($id);
        if (null === $organization) {
            return AdminResponse::notFound(self::NOT_FOUND);
        }

        $email = JsonBody::string($request, 'email');
        $firstName = JsonBody::string($request, 'firstName');
        $lastName = JsonBody::string($request, 'lastName');

        $errors = $this->provisioner->personErrors($email, $firstName, $lastName);
        if ([] !== $errors) {
            return AdminResponse::invalidFields($errors);
        }

        $role = OrganizationRole::tryFrom(JsonBody::string($request, 'role'));
        if (null === $role) {
            return AdminResponse::error(AdminResponse::INVALID_ROLE, 'invalid_role');
        }

        $user = $this->provisioner->createMember($organization, $email, $firstName, $lastName, $role);
        $this->auditLog->record($actor, AdminAction::UserCreated, $user->getEmail().', '.$organization->getName().', '.$role->value);
        $emailSent = $this->provisioner->sendActivation($user);

        return new JsonResponse(AdminResponse::user($user) + ['emailSent' => $emailSent], Response::HTTP_CREATED);
    }
}
