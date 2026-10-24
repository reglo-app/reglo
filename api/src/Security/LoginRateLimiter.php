<?php

namespace App\Security;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\DependencyInjection\Attribute\Target;
use Symfony\Component\HttpFoundation\RateLimiter\AbstractRequestRateLimiter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

/**
 * Login throttling of the "login" firewall: one limit per client IP (see
 * config/packages/rate_limiter.yaml). Every attempt is counted and a
 * successful login clears the counter.
 *
 * The key is hashed so that no IP address is stored in the cache.
 */
final class LoginRateLimiter extends AbstractRequestRateLimiter
{
    public function __construct(
        #[Target('login_ip')]
        private readonly RateLimiterFactoryInterface $ipLimiterFactory,
        #[Autowire(param: 'kernel.secret')]
        #[\SensitiveParameter]
        private readonly string $secret,
    ) {
    }

    protected function getLimiters(Request $request): array
    {
        $key = hash_hmac('sha256', (string) $request->getClientIp(), $this->secret);

        return [$this->ipLimiterFactory->create($key)];
    }
}
