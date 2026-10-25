<?php

namespace App\Tests\Controller;

use App\Entity\AccessToken;
use App\Entity\User;
use App\Security\AccessTokenManager;
use App\Security\LoginFailureHandler;
use App\Tests\DatabaseResetTrait;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class AuthControllerTest extends WebTestCase
{
    use DatabaseResetTrait;

    private const EMAIL = 'jeanne.martin@example.com';
    private const PASSWORD = 'correct-horse-battery';

    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        self::resetDatabase($this->entityManager);
    }

    public function testLoginWithValidCredentialsReturnsAToken(): void
    {
        $this->createUser();

        $this->login(self::EMAIL, self::PASSWORD);

        self::assertResponseIsSuccessful();
        $data = $this->responseData();
        self::assertSame(['token'], array_keys($data));
        self::assertIsString($data['token']);
        self::assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $data['token']);
    }

    public function testTokenIsStoredHashed(): void
    {
        $this->createUser();

        $this->login(self::EMAIL, self::PASSWORD);
        $plainToken = (string) $this->responseData()['token'];

        $repository = $this->entityManager->getRepository(AccessToken::class);
        self::assertNull($repository->findOneBy(['tokenHash' => $plainToken]));
        self::assertNotNull($repository->findOneBy(['tokenHash' => hash('sha256', $plainToken)]));
    }

    public function testLoginIgnoresEmailCase(): void
    {
        $this->createUser();

        $this->login('  Jeanne.MARTIN@Example.com ', self::PASSWORD);

        self::assertResponseIsSuccessful();
    }

    public function testLoginWithWrongPasswordReturnsGenericError(): void
    {
        $this->createUser();

        $this->login(self::EMAIL, 'wrong-password-123');

        self::assertResponseStatusCodeSame(401);
        self::assertSame(['error' => LoginFailureHandler::MESSAGE], $this->responseData());
    }

    public function testLoginWithUnknownEmailReturnsTheSameError(): void
    {
        $this->createUser();

        $this->login(self::EMAIL, 'wrong-password-123');
        $wrongPasswordBody = $this->client->getResponse()->getContent();

        $this->login('unknown@example.com', self::PASSWORD);

        self::assertResponseStatusCodeSame(401);
        self::assertSame($wrongPasswordBody, $this->client->getResponse()->getContent());
    }

    public function testLoginWithMissingPasswordIsRejected(): void
    {
        $this->client->jsonRequest('POST', '/api/auth/login', ['email' => self::EMAIL]);

        self::assertResponseStatusCodeSame(400);
    }

    public function testLoginWithoutJsonIsRejected(): void
    {
        $this->client->request('POST', '/api/auth/login', ['email' => self::EMAIL, 'password' => self::PASSWORD]);

        self::assertResponseStatusCodeSame(400);
        self::assertSame(['error' => 'Requête invalide.'], $this->responseData());
    }

    public function testLoginOnlyAcceptsPost(): void
    {
        $this->client->request('GET', '/api/auth/login');

        self::assertResponseStatusCodeSame(405);
    }

    public function testMeReturnsTheCurrentUserWithAValidToken(): void
    {
        $user = $this->createUser();
        $this->login(self::EMAIL, self::PASSWORD);
        $token = (string) $this->responseData()['token'];

        $this->client->request('GET', '/api/auth/me', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$token]);

        self::assertResponseIsSuccessful();
        self::assertSame([
            'id' => (string) $user->getId(),
            'email' => self::EMAIL,
            'firstName' => null,
            'lastName' => null,
            'role' => 'member',
            'organization' => null,
        ], $this->responseData());
    }

    /**
     * @return iterable<string, array{list<string>, string}>
     */
    public static function roleKeys(): iterable
    {
        yield 'administrator' => [['ROLE_ADMIN'], 'admin'];
        yield 'reader' => [['ROLE_READER'], 'reader'];
        yield 'no role: member' => [[], 'member'];
    }

    /**
     * @param list<string> $roles
     */
    #[DataProvider('roleKeys')]
    public function testMeReturnsTheRoleKeyOfTheWebApp(array $roles, string $expected): void
    {
        $user = $this->createUser();
        $user->setRoles($roles);
        $this->entityManager->flush();

        $this->client->request('GET', '/api/auth/me', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$this->loginToken()]);

        self::assertSame($expected, $this->responseData()['role']);
    }

    public function testMeWithoutTokenIsUnauthorized(): void
    {
        $this->client->request('GET', '/api/auth/me');

        self::assertResponseStatusCodeSame(401);
    }

    public function testMeWithUnknownTokenIsUnauthorized(): void
    {
        $this->client->request('GET', '/api/auth/me', server: ['HTTP_AUTHORIZATION' => 'Bearer '.str_repeat('a', 64)]);

        self::assertResponseStatusCodeSame(401);
    }

    public function testMeWithTheStoredHashInsteadOfTheTokenIsUnauthorized(): void
    {
        $this->createUser();
        $this->login(self::EMAIL, self::PASSWORD);
        $hash = AccessTokenManager::hash((string) $this->responseData()['token']);

        $this->client->request('GET', '/api/auth/me', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$hash]);

        self::assertResponseStatusCodeSame(401);
    }

    public function testMeWithExpiredTokenIsUnauthorized(): void
    {
        $user = $this->createUser();
        $plainToken = 'expired-token';
        $this->entityManager->persist(new AccessToken($user, AccessTokenManager::hash($plainToken), new \DateTimeImmutable('-1 second')));
        $this->entityManager->flush();

        $this->client->request('GET', '/api/auth/me', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$plainToken]);

        self::assertResponseStatusCodeSame(401);
    }

    public function testLogoutDeletesTheAccessToken(): void
    {
        $this->createUser();
        $token = $this->loginToken();

        $this->client->request('POST', '/api/auth/logout', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$token]);

        self::assertResponseStatusCodeSame(204);
        $repository = $this->entityManager->getRepository(AccessToken::class);
        self::assertNull($repository->findOneBy(['tokenHash' => AccessTokenManager::hash($token)]));

        $this->client->request('GET', '/api/auth/me', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$token]);

        self::assertResponseStatusCodeSame(401);
    }

    public function testLogoutKeepsTheOtherTokensOfTheUser(): void
    {
        $this->createUser();
        $first = $this->loginToken();
        $second = $this->loginToken();

        $this->client->request('POST', '/api/auth/logout', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$first]);
        $this->client->request('GET', '/api/auth/me', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$second]);

        self::assertResponseIsSuccessful();
    }

    public function testLogoutWithoutTokenIsUnauthorized(): void
    {
        $this->client->request('POST', '/api/auth/logout');

        self::assertResponseStatusCodeSame(401);
    }

    public function testLogoutOnlyAcceptsPost(): void
    {
        $this->createUser();

        $this->client->request('GET', '/api/auth/logout', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$this->loginToken()]);

        self::assertResponseStatusCodeSame(405);
    }

    public function testHealthStaysPublic(): void
    {
        $this->client->request('GET', '/health');

        self::assertResponseIsSuccessful();
    }

    public function testApiDocsStayPublic(): void
    {
        $this->client->request('GET', '/api/docs.jsonopenapi');

        self::assertResponseIsSuccessful();
    }

    private function createUser(): User
    {
        $user = new User(self::EMAIL);
        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);
        $user->setPassword($hasher->hashPassword($user, self::PASSWORD));

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return $user;
    }

    private function loginToken(): string
    {
        $this->login(self::EMAIL, self::PASSWORD);
        self::assertResponseIsSuccessful();

        return (string) $this->responseData()['token'];
    }

    private function login(string $email, string $password): void
    {
        $this->client->jsonRequest('POST', '/api/auth/login', ['email' => $email, 'password' => $password]);
    }

    /**
     * @return array<string, mixed>
     */
    private function responseData(): array
    {
        $data = json_decode((string) $this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertIsArray($data);

        return $data;
    }
}
