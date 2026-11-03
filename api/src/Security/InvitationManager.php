<?php

namespace App\Security;

use App\Entity\Invitation;
use App\Entity\User;
use App\Repository\InvitationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Invitation links (US-03): issued when an administrator invites a
 * collaborator, accepted when the collaborator chooses a password. Only the
 * SHA-256 hash of the token is stored.
 */
final class InvitationManager
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly InvitationRepository $repository,
        private readonly UserPasswordHasherInterface $passwordHasher,
        #[Autowire(param: 'app.invitation_ttl')]
        private readonly int $ttl,
    ) {
    }

    /**
     * Gives the invitation a new link (the previous one stops working) and
     * saves it. Returns the plain token, to put in the e-mail only.
     */
    public function issue(Invitation $invitation): string
    {
        $plainToken = bin2hex(random_bytes(32));
        $invitation->renew(self::hash($plainToken), new \DateTimeImmutable(\sprintf('+%d seconds', $this->ttl)));

        $this->entityManager->persist($invitation);
        $this->entityManager->flush();

        return $plainToken;
    }

    public function findValid(string $plainToken): ?Invitation
    {
        if ('' === $plainToken) {
            return null;
        }

        $invitation = $this->repository->findOneByTokenHash(self::hash($plainToken));

        return null === $invitation || $invitation->isExpired() ? null : $invitation;
    }

    /**
     * Creates the account of the invited person in the organization of the
     * invitation, activated, with the role of the invitation, and deletes
     * the invitation. The
     * caller checks that the e-mail is still free.
     */
    public function accept(Invitation $invitation, string $firstName, string $lastName, string $plainPassword): User
    {
        $user = (new User($invitation->getEmail()))
            ->setName($firstName, $lastName)
            ->setOrganization($invitation->getOrganization())
            ->setOrganizationRole($invitation->getRole());
        $user->activate($this->passwordHasher->hashPassword($user, $plainPassword));

        $this->entityManager->persist($user);
        $this->entityManager->remove($invitation);
        $this->entityManager->flush();

        return $user;
    }

    public static function hash(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }
}
