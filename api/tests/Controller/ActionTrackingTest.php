<?php

namespace App\Tests\Controller;

use App\Entity\Action;
use App\Entity\ActionStatus;
use App\Entity\ActionType;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Entity\QhsePillar;
use App\Entity\User;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/**
 * US-10: late and soon due actions, filters and dashboard overview. "Today"
 * is frozen on 10 November 2026 in France.
 */
final class ActionTrackingTest extends ProfileTestCase
{
    use ClockSensitiveTrait;

    private User $colleague;

    protected function setUp(): void
    {
        parent::setUp();
        self::mockTime('2026-11-10 10:00:00 UTC');
        $this->colleague = $this->createUser('paul.martin@acme.test', $this->organization)->setName('Paul', 'Martin');
        $this->entityManager->flush();
    }

    /**
     * @return iterable<string, array{string, ActionStatus, bool, bool}>
     */
    public static function dueDates(): iterable
    {
        yield 'yesterday' => ['2026-11-09', ActionStatus::Todo, true, false];
        yield 'today' => ['2026-11-10', ActionStatus::InProgress, false, true];
        yield 'in 7 days' => ['2026-11-17', ActionStatus::Todo, false, true];
        yield 'in 8 days' => ['2026-11-18', ActionStatus::Todo, false, false];
        yield 'late but done' => ['2026-11-01', ActionStatus::Done, false, false];
        yield 'soon but done' => ['2026-11-12', ActionStatus::Done, false, false];
    }

    #[DataProvider('dueDates')]
    public function testAnActionIsLateOrDueSoonAgainstItsDueDate(string $dueDate, ActionStatus $status, bool $overdue, bool $dueSoon): void
    {
        $this->createAction($dueDate, status: $status);

        $this->getAs('/api/actions');

        self::assertResponseIsSuccessful();
        self::assertSame($overdue, $this->firstAction()['isOverdue']);
        self::assertSame($dueSoon, $this->firstAction()['isDueSoon']);
    }

    public function testTodayIsTheDayInFrance(): void
    {
        // Still the 10th in UTC, already the 11th in Paris.
        self::mockTime('2026-11-10 23:30:00 UTC');
        $this->createAction('2026-11-10');

        $this->getAs('/api/actions');

        self::assertTrue($this->firstAction()['isOverdue']);
    }

    public function testOneActionAlsoTellsIfItIsLate(): void
    {
        $action = $this->createAction('2026-11-09');

        $this->getAs('/api/actions/'.$action->getId());

        self::assertTrue($this->responseData()['isOverdue']);
        self::assertFalse($this->responseData()['isDueSoon']);
    }

    /**
     * @return iterable<string, array{string, list<string>}>
     */
    public static function filters(): iterable
    {
        yield 'no filter' => ['', ['late', 'review', 'soon', 'later', 'finished']];
        yield 'status' => ['status=in_review', ['review']];
        yield 'domain' => ['domain=environment', ['later']];
        yield 'type' => ['type=improvement', ['review', 'later']];
        yield 'late' => ['due=overdue', ['late']];
        yield 'due soon' => ['due=soon', ['review', 'soon']];
        yield 'upcoming' => ['due=upcoming', ['review', 'soon', 'later']];
        yield 'together' => ['due=soon&type=improvement', ['review']];
        yield 'nothing matches' => ['status=todo&domain=quality', []];
        yield 'empty values are ignored' => ['status=&domain=&type=&due=&assignee=&order=', ['late', 'review', 'soon', 'later', 'finished']];
        yield 'latest first' => ['order=desc', ['finished', 'later', 'soon', 'review', 'late']];
    }

    /**
     * @param list<string> $titles
     */
    #[DataProvider('filters')]
    public function testActionsAreFiltered(string $query, array $titles): void
    {
        $this->createFilteredActions();

        $this->getAs('/api/actions?'.$query);

        self::assertResponseIsSuccessful();
        self::assertSame($titles, array_column($this->responseData(), 'title'));
    }

    public function testActionsAreFilteredByAssignee(): void
    {
        $this->createAction('2026-11-20', 'mine', assignee: $this->user);
        $this->createAction('2026-11-21', 'his', assignee: $this->colleague);

        $this->getAs('/api/actions?assignee='.$this->colleague->getId());

        self::assertSame(['his'], array_column($this->responseData(), 'title'));
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function invalidFilters(): iterable
    {
        yield 'status' => ['status=finished'];
        yield 'domain' => ['domain=finance'];
        yield 'type' => ['type=urgent'];
        yield 'due' => ['due=tomorrow'];
        yield 'assignee' => ['assignee=paul'];
        yield 'order' => ['order=random'];
    }

    #[DataProvider('invalidFilters')]
    public function testAnUnknownFilterIsRefused(string $query): void
    {
        $this->getAs('/api/actions?'.$query);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('invalid_filter', $this->responseData()['code']);
        self::assertSame('Ce filtre n\'existe pas.', $this->responseData()['error']);
    }

    public function testFiltersNeverReachAnotherOrganization(): void
    {
        $other = new Organization('Globex');
        $this->entityManager->persist($other);
        $stranger = $this->createUser('sam@globex.test', $other);
        $this->createAction('2026-11-09', 'theirs', assignee: $stranger, organization: $other);
        $this->createAction('2026-11-09', 'ours');

        $this->getAs('/api/actions?assignee='.$stranger->getId());
        self::assertSame([], $this->responseData());

        $this->getAs('/api/actions?due=overdue');
        self::assertSame(['ours'], array_column($this->responseData(), 'title'));
    }

    public function testTheOverviewCountsTheActions(): void
    {
        $this->createFilteredActions();

        $this->getAs('/api/actions/overview');

        self::assertResponseIsSuccessful();
        $overview = $this->responseData();
        self::assertSame('2026-11-10', $overview['today']);
        self::assertSame(1, $overview['counts']['overdue']);
        self::assertSame(2, $overview['counts']['dueSoon']);
        self::assertSame(2, $overview['counts']['todo']);
        self::assertSame(1, $overview['counts']['in_progress']);
        self::assertSame(1, $overview['counts']['in_review']);
        self::assertSame(1, $overview['counts']['done']);
        self::assertSame(['late', 'review', 'soon'], array_column($overview['urgent'], 'title'));
        self::assertSame(['review', 'soon', 'later'], array_column($overview['upcoming'], 'title'));
    }

    public function testTheOverviewListsAtMostFiveActionsInEachBlock(): void
    {
        for ($day = 10; $day <= 16; ++$day) {
            $this->createAction(\sprintf('2026-11-%d', $day), \sprintf('day %d', $day));
        }

        $this->getAs('/api/actions/overview');

        $overview = $this->responseData();
        self::assertSame(7, $overview['counts']['dueSoon']);
        self::assertCount(5, $overview['urgent']);
        self::assertCount(5, $overview['upcoming']);
        self::assertSame('day 10', $overview['urgent'][0]['title']);
    }

    public function testTheOverviewOfAnEmptyPlanIsAllZeros(): void
    {
        $this->getAs('/api/actions/overview');

        self::assertResponseIsSuccessful();
        self::assertSame(
            ['overdue' => 0, 'dueSoon' => 0, 'todo' => 0, 'in_progress' => 0, 'in_review' => 0, 'done' => 0],
            $this->responseData()['counts'],
        );
        self::assertSame([], $this->responseData()['urgent']);
    }

    public function testTheOverviewOnlyCountsTheOwnOrganization(): void
    {
        $other = new Organization('Globex');
        $this->entityManager->persist($other);
        $stranger = $this->createUser('sam@globex.test', $other);
        $this->createAction('2026-11-09', 'theirs', assignee: $stranger, organization: $other);

        $this->getAs('/api/actions/overview');

        self::assertSame(0, $this->responseData()['counts']['overdue']);
        self::assertSame(0, $this->responseData()['counts']['todo']);
        self::assertSame([], $this->responseData()['urgent']);
    }

    public function testAReaderConsultsTheFiltersAndTheOverview(): void
    {
        $reader = $this->createUser('rita@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $this->entityManager->flush();
        $token = $this->issueToken($reader);

        $this->getAs('/api/actions?due=overdue', $token);
        self::assertResponseIsSuccessful();

        $this->getAs('/api/actions/overview', $token);
        self::assertResponseIsSuccessful();
    }

    public function testTheOverviewRequiresALogin(): void
    {
        $this->client->request('GET', '/api/actions/overview');

        self::assertResponseStatusCodeSame(401);
    }

    /**
     * @return array<string, mixed>
     */
    private function firstAction(): array
    {
        $action = array_values($this->responseData())[0];
        self::assertIsArray($action);

        return $action;
    }

    private function createFilteredActions(): void
    {
        $this->createAction('2026-11-09', 'late', QhsePillar::Safety, ActionType::Corrective);
        $this->createAction('2026-11-10', 'review', QhsePillar::Quality, ActionType::Improvement, ActionStatus::InReview);
        $this->createAction('2026-11-17', 'soon', QhsePillar::Hygiene, ActionType::Preventive, ActionStatus::InProgress);
        $this->createAction('2026-11-18', 'later', QhsePillar::Environment, ActionType::Improvement);
        $this->createAction('2026-11-19', 'finished', QhsePillar::Safety, ActionType::Corrective, ActionStatus::Done);
    }

    private function createAction(
        string $dueDate,
        string $title = 'Vérifier les extincteurs',
        QhsePillar $pillar = QhsePillar::Safety,
        ActionType $type = ActionType::Preventive,
        ActionStatus $status = ActionStatus::Todo,
        ?User $assignee = null,
        ?Organization $organization = null,
    ): Action {
        $assignee ??= $this->user;
        $action = new Action($organization ?? $this->organization, $title, '', $pillar, $type, new \DateTimeImmutable($dueDate), $assignee, $assignee);
        if (ActionStatus::Todo !== $status) {
            $action->moveTo($status, $assignee);
        }
        $this->entityManager->persist($action);
        $this->entityManager->flush();

        return $action;
    }
}
