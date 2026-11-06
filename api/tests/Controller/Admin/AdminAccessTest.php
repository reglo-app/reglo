<?php

namespace App\Tests\Controller\Admin;

use App\Entity\Document;
use App\Entity\OrganizationRole;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * The back office is for the REGLO team only (rule 2), and the REGLO team
 * still does not read the data of the clients (rule 1).
 */
final class AdminAccessTest extends AdminTestCase
{
    /**
     * Every route of the back office.
     *
     * @return iterable<string, array{string, string}>
     */
    public static function backOfficeRoutes(): iterable
    {
        foreach ([
            ['GET', '/api/admin/organizations'],
            ['POST', '/api/admin/organizations'],
            ['GET', '/api/admin/organizations/1'],
            ['PATCH', '/api/admin/organizations/1'],
            ['DELETE', '/api/admin/organizations/1'],
            ['POST', '/api/admin/organizations/1/users'],
            ['GET', '/api/admin/users'],
            ['PATCH', '/api/admin/users/1'],
            ['DELETE', '/api/admin/users/1'],
            ['POST', '/api/admin/users/1/resend-activation'],
            ['GET', '/api/admin/team'],
            ['POST', '/api/admin/team'],
            ['DELETE', '/api/admin/team/1'],
        ] as [$method, $uri]) {
            yield $method.' '.$uri => [$method, $uri];
        }
    }

    #[DataProvider('backOfficeRoutes')]
    public function testNobodyGetsInWithoutSession(string $method, string $uri): void
    {
        $this->client->jsonRequest($method, $uri);

        self::assertResponseStatusCodeSame(401);
    }

    #[DataProvider('backOfficeRoutes')]
    public function testAnAdministratorOfAClientDoesNotGetIn(string $method, string $uri): void
    {
        $this->user->setOrganizationRole(OrganizationRole::Admin);
        $this->entityManager->flush();

        $this->jsonAs($method, $uri);

        self::assertResponseStatusCodeSame(403);
    }

    #[DataProvider('backOfficeRoutes')]
    public function testAMemberOrReaderOfAClientDoesNotGetIn(string $method, string $uri): void
    {
        foreach ([OrganizationRole::Member, OrganizationRole::Reader] as $role) {
            $this->user->setOrganizationRole($role);
            $this->entityManager->flush();

            $this->jsonAs($method, $uri);

            self::assertResponseStatusCodeSame(403);
        }
    }

    public function testEveryRouteOfTheBackOfficeIsInTheListAbove(): void
    {
        $tested = [];
        foreach (self::backOfficeRoutes() as [$method, $uri]) {
            $tested[] = $method.' '.preg_replace('/\/1(\/|$)/', '/{id}$1', $uri);
        }

        $found = [];
        foreach (static::getContainer()->get('router')->getRouteCollection() as $route) {
            if (str_starts_with($route->getPath(), '/api/admin')) {
                foreach ($route->getMethods() as $method) {
                    $found[] = $method.' '.$route->getPath();
                }
            }
        }

        sort($tested);
        sort($found);
        self::assertSame($tested, $found);
    }

    public function testTheWebAppKnowsWhoIsFromTheTeam(): void
    {
        $this->getAs('/api/auth/me', $this->teamToken);
        self::assertTrue($this->responseData()['platformAdmin']);

        $this->getAs('/api/auth/me');
        self::assertFalse($this->responseData()['platformAdmin']);
    }

    public function testTheTeamDoesNotReadTheDocumentsOfAClient(): void
    {
        $document = new Document($this->organization, 'duerp.pdf', str_repeat('f', 32), 'application/pdf', 3, null, $this->user);
        $this->entityManager->persist($document);
        $this->entityManager->flush();

        $this->adminGet('/api/documents');
        self::assertResponseIsSuccessful();
        self::assertSame([], $this->responseList());

        $this->adminGet('/api/documents/'.$document->getId().'/download');
        self::assertResponseStatusCodeSame(404);

        $this->adminGet('/api/actions');
        self::assertSame([], $this->responseList());
    }
}
