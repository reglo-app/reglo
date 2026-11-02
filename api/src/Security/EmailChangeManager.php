<?php

namespace App\Security;

use App\Entity\EmailChangeRequest;
use App\Entity\User;
use App\Repository\EmailChangeRequestRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Change of the account e-mail: a link is sent to the new address, which
 * only replaces the old one once the link is opened. Only the SHA-256 hash
 * of the token is stored.
 */
final class EmailChangeManager
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly EmailChangeRequestRepository $repository,
        private readonly UserRepository $userRepository,
        private readonly AccessTokenManager $accessTokenManager,
        #[Autowire(param: 'app.email_change_ttl')]
        private readonly int $ttl,
    ) {
    }

    /**
     * Replaces the previous requests of the user: only the latest link works.
     */
    public function request(User $user, string $newEmail): string
    {
        $this->repository->deleteAllForUser($user);

        $plainToken = bin2hex(random_bytes(32));
        $expiresAt = new \DateTimeImmutable(\sprintf('+%d seconds', $this->ttl));

        $this->entityManager->persist(new EmailChangeRequest($user, $newEmail, self::hash($plainToken), $expiresAt));
        $this->entityManager->flush();

        return $plainToken;
    }

    public function findValid(string $plainToken): ?EmailChangeRequest
    {
        $request = $this->repository->findOneByTokenHash(self::hash($plainToken));

        return null === $request || $request->isExpired() ? null : $request;
    }

    public function isEmailTaken(string $email): bool
    {
        return null !== $this->userRepository->findOneByEmail($email);
    }

    /**
     * Applies the new address and logs the user out everywhere: the
     * sessions were opened with the old one.
     */
    public function confirm(EmailChangeRequest $request): void
    {
        $user = $request->getUser();
        $user->changeEmail($request->getNewEmail());
        $this->repository->deleteAllForUser($user);
        $this->accessTokenManager->revokeAllForUser($user);
        $this->entityManager->flush();
    }

    public static function hash(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }
}
