<?php

namespace App\Security;

use App\Entity\AccessToken;
use App\Entity\User;
use App\Repository\AccessTokenRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Issues and resolves opaque access tokens. The plain token is returned
 * once to the client, only its SHA-256 hash is stored.
 */
final class AccessTokenManager
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly AccessTokenRepository $repository,
        #[Autowire(param: 'app.access_token_ttl')]
        private readonly int $ttl,
    ) {
    }

    public function issue(User $user): string
    {
        $plainToken = bin2hex(random_bytes(32));
        $expiresAt = new \DateTimeImmutable(\sprintf('+%d seconds', $this->ttl));

        $this->entityManager->persist(new AccessToken($user, self::hash($plainToken), $expiresAt));
        $this->entityManager->flush();

        return $plainToken;
    }

    /**
     * Returns the stored token if it exists and is not expired.
     */
    public function findValid(string $plainToken): ?AccessToken
    {
        $token = $this->repository->findOneByTokenHash(self::hash($plainToken));

        if (null === $token || $token->isExpired()) {
            return null;
        }

        return $token;
    }

    /**
     * Deletes the stored token, so it can no longer be used (logout).
     */
    public function revoke(string $plainToken): void
    {
        $token = $this->repository->findOneByTokenHash(self::hash($plainToken));

        if (null === $token) {
            return;
        }

        $this->entityManager->remove($token);
        $this->entityManager->flush();
    }

    public static function hash(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }
}
