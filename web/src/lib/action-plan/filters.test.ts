import { describe, expect, it } from "vitest";

import {
    actionFiltersQuery,
    hasActionFilters,
    parseActionFilters,
} from "@/lib/action-plan/filters";
import { withActionsOverview } from "@/lib/action-plan/overview";
import {
    filterMockActions,
    mockActionsOverview,
    mockDashboardSummary,
} from "@/lib/api/mocks";

describe("parseActionFilters", () => {
    it("reads the filters of the URL", () => {
        expect(
            parseActionFilters(
                {
                    status: "todo",
                    domain: "safety",
                    type: "corrective",
                    assignee: "7",
                    due: "overdue",
                    order: "desc",
                },
                ["7"],
            ),
        ).toEqual({
            status: "todo",
            domain: "safety",
            type: "corrective",
            assignee: "7",
            due: "overdue",
            order: "desc",
        });
    });

    it("ignores what does not exist, instead of an error page", () => {
        expect(
            parseActionFilters(
                {
                    status: "finished",
                    domain: "finance",
                    type: ["corrective", "preventive"],
                    assignee: "999",
                    due: "tomorrow",
                    order: "random",
                    other: "x",
                },
                ["7"],
            ),
        ).toEqual({});
    });
});

describe("actionFiltersQuery", () => {
    it("builds the query, and nothing without filter", () => {
        expect(actionFiltersQuery({})).toBe("");
        expect(actionFiltersQuery({ status: undefined })).toBe("");
        expect(actionFiltersQuery({ status: "todo", due: "soon" })).toBe(
            "?status=todo&due=soon",
        );
    });
});

describe("hasActionFilters", () => {
    it("does not count the order: it hides nothing", () => {
        expect(hasActionFilters({})).toBe(false);
        expect(hasActionFilters({ order: "desc" })).toBe(false);
        expect(hasActionFilters({ due: "soon" })).toBe(true);
        expect(hasActionFilters({ assignee: "7" })).toBe(true);
    });
});

describe("filterMockActions", () => {
    const ids = (filters: Parameters<typeof filterMockActions>[0]) =>
        filterMockActions(filters).map((action) => action.id);

    it("follows the rules of the API", () => {
        expect(ids({})).toEqual(["1", "2", "3", "4"]);
        expect(ids({ due: "overdue" })).toEqual(["1"]);
        expect(ids({ due: "soon" })).toEqual(["2"]);
        expect(ids({ due: "upcoming" })).toEqual(["2", "3"]);
        expect(ids({ status: "done" })).toEqual(["4"]);
        expect(ids({ domain: "safety", type: "preventive" })).toEqual(["2"]);
        expect(ids({ order: "desc" })).toEqual(["4", "3", "2", "1"]);
    });
});

describe("withActionsOverview", () => {
    it("replaces the mock alerts and actions by the real ones", () => {
        const summary = withActionsOverview(
            mockDashboardSummary,
            mockActionsOverview,
        );

        expect(summary.generatedAt).toBe("2026-10-16");
        expect(summary.alerts.map((alert) => alert.title)).toEqual([
            "Mettre à jour le DUERP",
            "Vérifier les extincteurs de l'atelier",
        ]);
        expect(summary.alerts[0].kind).toBe("action_due");
        expect(summary.upcomingActions.map((a) => a.id)).toEqual(["2", "3"]);
        expect(summary.upcomingActions[0].ownerName).toBe("Hugo Bernard");
        // Not computed yet: nothing rather than a made-up rate.
        expect(summary.actionsOnTimeRate).toBeNull();
        // The other blocks keep their data.
        expect(summary.latestNews).toBe(mockDashboardSummary.latestNews);
    });

    it("empties the blocks when there is no action", () => {
        const summary = withActionsOverview(mockDashboardSummary, {
            ...mockActionsOverview,
            urgent: [],
            upcoming: [],
        });

        expect(summary.alerts).toEqual([]);
        expect(summary.upcomingActions).toEqual([]);
    });
});
