<?php

namespace App\Tests;

use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Contracts\HttpClient\ResponseInterface;

/**
 * Answers every HTTP request of the tests instead of the data service (see
 * config/packages/framework.yaml). Static: it survives the kernel reboot
 * between two requests of a test. Call reset() in setUp().
 */
final class DataServiceMock
{
    /** @var (\Closure(string, string, array<string, mixed>): ResponseInterface)|null */
    public static ?\Closure $handler = null;

    /** @var list<array{method: string, url: string, body: array<mixed>}> */
    public static array $requests = [];

    public static function reset(): void
    {
        self::$handler = null;
        self::$requests = [];
    }

    /**
     * A score as the data service computes it.
     *
     * @param array<string, float|null> $pillars
     */
    public static function score(float $global = 62.5, array $pillars = ['quality' => 70.0, 'hygiene' => 55.0, 'safety' => 50.0, 'environment' => 75.0]): MockResponse
    {
        return new MockResponse(json_encode([
            'algo_version' => '1.0.0',
            'questionnaire_version' => 'any',
            'global' => $global,
            'maturity' => 'Maîtrisé',
            'pillars' => $pillars,
            'themes' => ['pilotage' => 80.0, 'risques' => 40.0],
            'coverage' => 0.95,
            'gaps' => [['question_id' => 'safety.risques.01', 'label' => 'DUERP à jour ?', 'pillar' => 'safety', 'theme' => 'risques', 'score' => 30.0, 'potential_points' => 12.5, 'capped_for_proof' => false]],
        ], \JSON_THROW_ON_ERROR), ['http_code' => 200, 'response_headers' => ['content-type' => 'application/json']]);
    }

    /**
     * @param array<string, mixed> $options
     */
    public function __invoke(string $method, string $url, array $options = []): ResponseInterface
    {
        $body = json_decode(\is_string($options['body'] ?? null) ? $options['body'] : '[]', true);
        self::$requests[] = ['method' => $method, 'url' => $url, 'body' => \is_array($body) ? $body : []];

        return null === self::$handler ? self::score() : (self::$handler)($method, $url, $options);
    }
}
