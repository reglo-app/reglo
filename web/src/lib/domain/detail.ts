import { toSummary } from "@/lib/action-plan/overview";
import type {
    Action,
    DiagnosticResult,
    DomainDetail,
    Questionnaire,
    ThemeScore,
} from "@/lib/api/types";
import { roundScore } from "@/lib/diagnostic/result";
import type { DomainKey } from "@/lib/domains";

/** Open actions shown on a pillar page. */
export const DOMAIN_ACTIONS_LIMIT = 5;

function rounded(score: number | null | undefined): number | null {
    return score === null || score === undefined ? null : roundScore(score);
}

/**
 * The page of one QHSE pillar from the real data of the organization: the
 * latest diagnostic (US-06) for the scores, the questionnaire for the theme
 * names and the action plan (US-09). Documents have no expiry date and the
 * regulatory news do not exist yet (US-15): those blocks stay empty.
 *
 * @param actions actions of the pillar, soonest due first (API order)
 * @param today "YYYY-MM-DD" in France
 */
export function buildDomainDetail(
    domain: DomainKey,
    result: DiagnosticResult | null,
    questionnaire: Questionnaire,
    actions: Action[],
    today: string,
): DomainDetail {
    const score = rounded(result?.score.pillars[domain]);
    const pillar = questionnaire.pillars.find((p) => p.id === domain);
    const themes: ThemeScore[] =
        score === null || result === null
            ? []
            : (pillar?.themes ?? []).flatMap((theme) => {
                  const themeScore = rounded(result.score.themes[theme.id]);
                  return themeScore === null
                      ? []
                      : [
                            {
                                id: theme.id,
                                label: theme.label,
                                score: themeScore,
                            },
                        ];
              });

    return {
        generatedAt: today,
        domain,
        score,
        previousScore:
            score === null ? null : rounded(result?.previous?.pillars[domain]),
        themes,
        actions: actions
            .filter(
                (action) =>
                    action.domain === domain && action.status !== "done",
            )
            .slice(0, DOMAIN_ACTIONS_LIMIT)
            .map(toSummary),
        expiringDocuments: [],
        latestNews: [],
    };
}
