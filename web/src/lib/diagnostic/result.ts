import type {
    DashboardSummary,
    DiagnosticResult,
    DomainScore,
} from "@/lib/api/types";
import { DOMAIN_KEYS } from "@/lib/domains";

/** Scores are shown as whole numbers ("62 / 100"). */
export function roundScore(score: number): number {
    return Math.round(score);
}

/**
 * The score block of the dashboard with the real score of the latest
 * diagnostic (US-06); the other blocks keep their data. Without result,
 * the block invites to make the first diagnostic.
 */
export function withDiagnosticScore(
    summary: DashboardSummary,
    result: DiagnosticResult | null,
): DashboardSummary {
    if (result === null || result.score.global === null) {
        return {
            ...summary,
            globalScore: null,
            previousGlobalScore: null,
            lastDiagnosticAt: null,
            domains: [],
        };
    }

    const domains: DomainScore[] = DOMAIN_KEYS.flatMap((domain) => {
        const score = result.score.pillars[domain];
        if (score === null || score === undefined) return [];
        const previous = result.previous?.pillars[domain];
        return [
            {
                domain,
                score: roundScore(score),
                previousScore:
                    previous === null || previous === undefined
                        ? null
                        : roundScore(previous),
            },
        ];
    });

    return {
        ...summary,
        globalScore: roundScore(result.score.global),
        previousGlobalScore:
            result.previous?.global === null || result.previous === null
                ? null
                : roundScore(result.previous.global),
        lastDiagnosticAt: result.submittedAt,
        domains,
    };
}
