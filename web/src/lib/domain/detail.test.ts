import { describe, expect, it } from "vitest";

import { mockActions, mockQuestionnaire } from "@/lib/api/mocks";
import type { Action, DiagnosticResult } from "@/lib/api/types";

import { buildDomainDetail, DOMAIN_ACTIONS_LIMIT } from "./detail";

const TODAY = "2026-11-25";

function result(
    pillars: DiagnosticResult["score"]["pillars"],
    themes: Record<string, number | null>,
    previous: DiagnosticResult["previous"] = null,
): DiagnosticResult {
    return {
        diagnosticId: "1",
        submittedAt: "2026-11-20T10:00:00+01:00",
        questionnaireVersion: mockQuestionnaire.version,
        score: {
            global: 60,
            maturity: null,
            pillars,
            themes,
            coverage: 1,
            gaps: [],
            algoVersion: null,
        },
        previous,
    };
}

function action(id: string, changes: Partial<Action>): Action {
    return { ...mockActions[0], id, ...changes };
}

const safetyThemes = mockQuestionnaire.pillars.find(
    (pillar) => pillar.id === "safety",
)!.themes;

describe("buildDomainDetail", () => {
    it("has no score and no themes before the first diagnostic", () => {
        const detail = buildDomainDetail(
            "safety",
            null,
            mockQuestionnaire,
            [],
            TODAY,
        );

        expect(detail).toEqual({
            generatedAt: TODAY,
            domain: "safety",
            score: null,
            previousScore: null,
            themes: [],
            actions: [],
            expiringDocuments: [],
            latestNews: [],
        });
    });

    it("takes the pillar and theme scores of the latest diagnostic, rounded", () => {
        const [first, second] = safetyThemes;
        const detail = buildDomainDetail(
            "safety",
            result(
                { safety: 48.6, quality: 90 },
                { [first.id]: 40.4, [second?.id ?? "none"]: null },
                {
                    submittedAt: "2026-06-01T10:00:00+02:00",
                    global: 50,
                    pillars: { safety: 41.5 },
                },
            ),
            mockQuestionnaire,
            [],
            TODAY,
        );

        expect(detail.score).toBe(49);
        expect(detail.previousScore).toBe(42);
        // Named after the questionnaire; a theme without score is left out.
        expect(detail.themes).toEqual([
            { id: first.id, label: first.label, score: 40 },
        ]);
    });

    it("has no score when the pillar was not scored", () => {
        const detail = buildDomainDetail(
            "hygiene",
            result({ safety: 50 }, {}),
            mockQuestionnaire,
            [],
            TODAY,
        );

        expect(detail.score).toBeNull();
        expect(detail.themes).toEqual([]);
    });

    it("lists the open actions of the pillar only, in the API order", () => {
        const actions = [
            action("1", { domain: "safety", status: "todo" }),
            action("2", { domain: "safety", status: "done" }),
            action("3", { domain: "quality", status: "todo" }),
            ...["4", "5", "6", "7", "8"].map((id) =>
                action(id, { domain: "safety", status: "in_progress" }),
            ),
        ];

        const detail = buildDomainDetail(
            "safety",
            null,
            mockQuestionnaire,
            actions,
            TODAY,
        );

        expect(detail.actions.map((a) => a.id)).toEqual([
            "1",
            "4",
            "5",
            "6",
            "7",
        ]);
        expect(detail.actions).toHaveLength(DOMAIN_ACTIONS_LIMIT);
    });
});
