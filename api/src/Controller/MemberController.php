<?php

namespace App\Controller;

use App\Account\OrganizationMembers;
use App\Entity\OrganizationRole;
use App\Entity\User;
use App\Repository\UserRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Members of the organization of the signed-in user ("Équipe" page, and
 * later the choice of who is responsible for an action). Every role can see
 * them; administrators change their role and remove them (US-16). Only the
 * own organization is ever listed or changed: another one's member is 404.
 */
#[Route('/api/users', name: 'member_')]
final class MemberController
{
    public const LAST_ADMIN = 'Votre organisation doit garder au moins un administrateur. Nommez d\'abord un autre administrateur.';

    public function __construct(
        private readonly UserRepository $repository,
        private readonly OrganizationMembers $members,
    ) {
    }

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(#[CurrentUser] User $user): JsonResponse
    {
        $organization = $user->getOrganization();

        // Platform administrators belong to no client.
        if (null === $organization) {
            return new JsonResponse([]);
        }

        return new JsonResponse(array_map(self::view(...), $this->repository->findMembersOf($organization)));
    }

    /**
     * Body: {"role": "admin" | "member" | "reader"}. Takes effect at the
     * member's next request: roles are read from the database each time.
     */
    #[Route('/{id}', name: 'update', requirements: ['id' => '\d+'], methods: ['PATCH'])]
    #[IsGranted('ROLE_ADMIN')]
    public function update(int $id, Request $request, #[CurrentUser] User $admin): JsonResponse
    {
        $member = $this->findColleague($id, $admin);
        if (null === $member) {
            return self::notFound();
        }

        $role = OrganizationRole::tryFrom(JsonBody::string($request, 'role'));
        if (null === $role) {
            return self::error('Choisissez le rôle : administrateur, membre ou lecteur.', 'invalid_role');
        }

        if (!$this->members->changeRole($member, $role)) {
            return self::error(self::LAST_ADMIN, 'last_admin');
        }

        return new JsonResponse(self::view($member));
    }

    /**
     * Removes the member from the organization: their account is deleted
     * (sessions, links and profile photo included). Leaving oneself is not
     * done here: it is the erasure of one's own account (US-04).
     */
    #[Route('/{id}', name: 'remove', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    #[IsGranted('ROLE_ADMIN')]
    public function remove(int $id, #[CurrentUser] User $admin): Response
    {
        $member = $this->findColleague($id, $admin);
        if (null === $member) {
            return self::notFound();
        }
        if ($member->getId() === $admin->getId()) {
            return self::error('Vous ne pouvez pas vous retirer vous-même de l\'équipe.', 'cannot_remove_self');
        }

        if (!$this->members->remove($member)) {
            return self::error(self::LAST_ADMIN, 'last_admin');
        }

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * A user of the same organization as the administrator, or null (also
     * for another organization's user: they must not learn it exists).
     */
    private function findColleague(int $id, User $admin): ?User
    {
        $member = $this->repository->find($id);
        $organization = $admin->getOrganization();

        if (null === $member || null === $organization || $member->getOrganization()?->getId() !== $organization->getId()) {
            return null;
        }

        return $member;
    }

    /**
     * Shape of Member in web/src/lib/api/types.ts.
     *
     * @return array<string, mixed>
     */
    private static function view(User $member): array
    {
        return [
            'id' => (string) $member->getId(),
            'email' => $member->getEmail(),
            'firstName' => $member->getFirstName(),
            'lastName' => $member->getLastName(),
            'jobTitle' => $member->getJobTitle(),
            'avatarVersion' => $member->getAvatarUpdatedAt()?->format('U'),
            'role' => $member->getOrganizationRole()->value,
            // False until the member has chosen a password
            'activated' => $member->isActivated(),
            // Joined the team when the password was chosen; null before
            'joinedAt' => $member->getActivatedAt()?->format(\DATE_ATOM),
            // Last authenticated request, to the nearest 5 minutes
            'lastSeenAt' => $member->getLastSeenAt()?->format(\DATE_ATOM),
        ];
    }

    private static function error(string $message, string $code): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'code' => $code], Response::HTTP_UNPROCESSABLE_ENTITY);
    }

    private static function notFound(): JsonResponse
    {
        return new JsonResponse(['error' => 'Ce membre ne fait plus partie de l\'équipe.', 'code' => 'not_found'], Response::HTTP_NOT_FOUND);
    }
}
