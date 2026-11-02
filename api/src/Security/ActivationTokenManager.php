<?php

namespace App\Security;

use App\Entity\ActivationToken;
use App\Entity\User;
use App\Repository\ActivationTokenRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Issues and resolves single-use activation tokens. The plain token is only
 * sent in the e-mail, the database keeps its SHA-256 hash.
 */
final class ActivationTokenManager
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly ActivationTokenRepository $repository,
        #[Autowire(param: 'app.activation_token_ttl')]
        private readonly int $ttl,
    ) {
    }

    /**
     * Replaces the previous links of the user: only the latest one works.
     */
    public function issue(User $user): string
    {
        $this->repository->deleteAllForUser($user);

        $plainToken = bin2hex(random_bytes(32));
        $expiresAt = new \DateTimeImmutable(\sprintf('+%d seconds', $this->ttl));

        $this->entityManager->persist(new ActivationToken($user, self::hash($plainToken), $expiresAt));
        $this->entityManager->flush();

        return $plainToken;
    }

    /**
     * Returns the stored token if it exists, is not expired and its user is
     * not activated yet.
     */
    public function findValid(string $plainToken): ?ActivationToken
    {
        $token = $this->repository->findOneByTokenHash(self::hash($plainToken));

        if (null === $token || $token->isExpired() || $token->getUser()->isActivated()) {
            return null;
        }

        return $token;
    }

    /**
     * Deletes every link of the user once the password is chosen.
     */
    public function consume(ActivationToken $token): void
    {
        $this->repository->deleteAllForUser($token->getUser());
    }

    public static function hash(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }
}
