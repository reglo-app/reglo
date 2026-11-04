import { describe, expect, it } from "vitest";

import { mockDashboardSummary, mockDiagnosticResult } from "@/lib/api/mocks";

import { roundScore, withDiagnosticScore } from "./result";

describe("roundScore", () => {
    it("shows scores as whole numbers", () => {
        expect(roundScore(61.9)).toBe(62);
        expect(roundScore(49.5)).toBe(50);
        expect(roundScore(49.4)).toBe(49);
    });
});

describe("withDiagnosticScore", () => {
    it("puts the latest score and its trend on the dashboard", () => {
        const summary = withDiagnosticScore(
            mockDashboardSummary,
            mockDiagnosticResult,
        );

        expect(summary.globalScore).toBe(62);
        expect(summary.previousGlobalScore).toBe(57);
        expect(summary.lastDiagnosticAt).toBe(mockDiagnosticResult.submittedAt);
        expect(summary.domains).toEqual([
            { domain: "quality", score: 72, previousScore: 65 },
            { domain: "hygiene", score: 58, previousScore: 60 },
            { domain: "safety", score: 50, previousScore: 45 },
            { domain: "environment", score: 77, previousScore: 70 },
        ]);
        // The other blocks keep their data.
        expect(summary.alerts).toBe(mockDashboardSummary.alerts);
    });

    it("leaves out the domains that were not scored", () => {
        const summary = withDiagnosticScore(mockDashboardSummary, {
            ...mockDiagnosticResult,
            score: {
                ...mockDiagnosticResult.score,
                pillars: {
                    ...mockDiagnosticResult.score.pillars,
                    safety: null,
                },
            },
            previous: null,
        });

        expect(summary.domains.map((d) => d.domain)).toEqual([
            "quality",
            "hygiene",
            "environment",
        ]);
        expect(summary.previousGlobalScore).toBeNull();
        expect(summary.domains[0].previousScore).toBeNull();
    });

    it("invites to a first diagnostic when there is no score", () => {
        const summary = withDiagnosticScore(mockDashboardSummary, null);

        expect(summary.globalScore).toBeNull();
        expect(summary.lastDiagnosticAt).toBeNull();
        expect(summary.domains).toEqual([]);
    });
});
