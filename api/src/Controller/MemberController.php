<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Members of the organization of the signed-in user ("Équipe" page, and
 * later the choice of who is responsible for an action). Every role can see
 * them; only the own organization is ever listed.
 */
final class MemberController
{
    #[Route('/api/users', name: 'member_list', methods: ['GET'])]
    public function list(#[CurrentUser] User $user, UserRepository $repository): JsonResponse
    {
        $organization = $user->getOrganization();

        // Platform administrators belong to no client.
        if (null === $organization) {
            return new JsonResponse([]);
        }

        return new JsonResponse(array_map(
            static fn (User $member): array => [
                'id' => (string) $member->getId(),
                'email' => $member->getEmail(),
                'firstName' => $member->getFirstName(),
                'lastName' => $member->getLastName(),
                'jobTitle' => $member->getJobTitle(),
                'avatarVersion' => $member->getAvatarUpdatedAt()?->format('U'),
                'role' => CurrentUserView::roleKey($member),
                // False until the member has chosen a password
                'activated' => $member->isActivated(),
            ],
            $repository->findMembersOf($organization),
        ));
    }
}
