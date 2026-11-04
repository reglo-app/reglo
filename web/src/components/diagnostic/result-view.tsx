import Link from "next/link";
import {
    ChevronDown,
    ClipboardCheck,
    Lightbulb,
    RotateCcw,
} from "lucide-react";

import { ScoreRing, Trend } from "@/components/score";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DiagnosticResult, Questionnaire } from "@/lib/api/types";
import { roundScore } from "@/lib/diagnostic/result";
import {
    DOMAIN_FILL_CLASSES,
    DOMAIN_ICON_CLASSES,
    DOMAIN_TINT_CLASSES,
    DOMAINS,
} from "@/lib/domains";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const points = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** "62 / 100", or "Non concerné" when nothing was scored. */
function ScoreValue({ score }: { score: number | null | undefined }) {
    if (score === null || score === undefined) {
        return <span className="text-ink-muted">Non concerné</span>;
    }
    return (
        <span className="font-semibold text-ink">
            {roundScore(score)}
            <span className="font-normal text-ink-muted"> / 100</span>
        </span>
    );
}

/** Decorative: the number next to it says the same thing. */
function ScoreBar({
    score,
    fillClassName,
}: {
    score: number | null | undefined;
    fillClassName: string;
}) {
    return (
        <span
            aria-hidden="true"
            className="block h-2 overflow-hidden rounded-full bg-surface-subtle"
        >
            <span
                className={cn("block h-full rounded-full", fillClassName)}
                style={{ width: `${score ?? 0}%` }}
            />
        </span>
    );
}

/**
 * Result of the latest diagnostic (US-06): global score, score per pillar,
 * the questions to improve first, the detail per theme, and every score in
 * a table (text alternative of the charts).
 */
export function ResultView({
    result,
    questionnaire,
    canEdit,
}: {
    result: DiagnosticResult;
    /** Labels of the pillars and themes. */
    questionnaire: Questionnaire;
    canEdit: boolean;
}) {
    const { score, previous } = result;
    const global = score.global === null ? null : roundScore(score.global);
    const pillars = questionnaire.pillars.filter(
        (pillar) => pillar.id in score.pillars,
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Card tone="brand" className="relative isolate overflow-hidden">
                    <span
                        aria-hidden="true"
                        className="absolute -top-16 -right-16 -z-10 size-52 rounded-full bg-white/10"
                    />
                    <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
                        <h2 className="text-lg font-semibold">Score global</h2>
                        {global === null ? (
                            <p>Aucune question notée.</p>
                        ) : (
                            <ScoreRing
                                score={global}
                                label={`Score global : ${global} sur 100`}
                            />
                        )}
                        {score.maturity && (
                            <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
                                {score.maturity}
                            </span>
                        )}
                        {global !== null && (
                            <Trend
                                score={global}
                                previousScore={
                                    previous?.global === null || !previous
                                        ? null
                                        : roundScore(previous.global)
                                }
                                className="text-white"
                            />
                        )}
                        <p className="text-sm text-white/85">
                            Diagnostic validé le{" "}
                            {formatDate(result.submittedAt)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex flex-col gap-4">
                        <h2 className="text-lg font-semibold">
                            Score par domaine
                        </h2>
                        <ul className="flex flex-col gap-4">
                            {pillars.map((pillar) => {
                                const Icon = DOMAINS[pillar.id].icon;
                                const value = score.pillars[pillar.id];
                                const before = previous?.pillars[pillar.id];
                                return (
                                    <li
                                        key={pillar.id}
                                        className="flex flex-col gap-2"
                                    >
                                        <span className="flex items-center gap-2 text-base">
                                            <Icon
                                                aria-hidden="true"
                                                className={cn(
                                                    "size-5 shrink-0",
                                                    DOMAIN_ICON_CLASSES[
                                                        pillar.id
                                                    ],
                                                )}
                                            />
                                            <span className="flex-1 font-medium">
                                                {pillar.label}
                                            </span>
                                            {value !== null &&
                                                value !== undefined && (
                                                    <Trend
                                                        score={roundScore(
                                                            value,
                                                        )}
                                                        previousScore={
                                                            before === null ||
                                                            before === undefined
                                                                ? null
                                                                : roundScore(
                                                                      before,
                                                                  )
                                                        }
                                                    />
                                                )}
                                            <ScoreValue score={value} />
                                        </span>
                                        <ScoreBar
                                            score={value}
                                            fillClassName={
                                                DOMAIN_FILL_CLASSES[pillar.id]
                                            }
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    </CardContent>
                </Card>
            </div>

            {score.gaps.length > 0 && (
                <Card>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="flex items-center gap-2 text-lg font-semibold">
                                <Lightbulb
                                    aria-hidden="true"
                                    className="size-5 text-green-700"
                                />
                                Actions prioritaires
                            </h2>
                            <p className="text-ink-muted">
                                Les questions qui feraient le plus progresser
                                votre score global.
                            </p>
                        </div>
                        <ol className="flex flex-col divide-y divide-border rounded-lg border border-border">
                            {score.gaps.map((gap) => {
                                const domain = DOMAINS[gap.pillar];
                                return (
                                    <li
                                        key={gap.question_id}
                                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                                    >
                                        <span
                                            className={cn(
                                                "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium",
                                                DOMAIN_TINT_CLASSES[gap.pillar],
                                            )}
                                        >
                                            <domain.icon
                                                aria-hidden="true"
                                                className={cn(
                                                    "size-4",
                                                    DOMAIN_ICON_CLASSES[
                                                        gap.pillar
                                                    ],
                                                )}
                                            />
                                            {domain.label}
                                        </span>
                                        <span className="flex-1">
                                            {gap.label}
                                        </span>
                                        <span className="text-sm font-semibold whitespace-nowrap text-green-700">
                                            +{" "}
                                            {points.format(
                                                gap.potential_points,
                                            )}{" "}
                                            points possibles
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold">
                        Détail par thématique
                    </h2>
                    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                        {pillars.map((pillar) => (
                            <details key={pillar.id} className="group">
                                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle [&::-webkit-details-marker]:hidden">
                                    <span className="flex-1 font-medium">
                                        {pillar.label}
                                    </span>
                                    <ScoreValue
                                        score={score.pillars[pillar.id]}
                                    />
                                    <ChevronDown
                                        aria-hidden="true"
                                        className="size-4 text-ink-muted transition-transform group-open:rotate-180"
                                    />
                                </summary>
                                <ul className="flex flex-col gap-3 px-4 pt-1 pb-4">
                                    {pillar.themes.map((theme) => (
                                        <li
                                            key={theme.id}
                                            className="flex flex-col gap-1.5"
                                        >
                                            <span className="flex items-center justify-between gap-3 text-sm">
                                                <span>{theme.label}</span>
                                                <ScoreValue
                                                    score={
                                                        score.themes[theme.id]
                                                    }
                                                />
                                            </span>
                                            <ScoreBar
                                                score={score.themes[theme.id]}
                                                fillClassName={
                                                    DOMAIN_FILL_CLASSES[
                                                        pillar.id
                                                    ]
                                                }
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        ))}
                    </div>

                    {/* Text alternative of the charts above (RGAA). */}
                    <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-green-700">
                            Voir tous les scores sous forme de tableau
                        </summary>
                        <table className="mt-3 w-full border-collapse text-left">
                            <caption className="sr-only">
                                Scores du diagnostic du{" "}
                                {formatDate(result.submittedAt)}
                            </caption>
                            <thead>
                                <tr className="border-b border-border">
                                    <th
                                        scope="col"
                                        className="py-2 pr-3 font-medium"
                                    >
                                        Domaine
                                    </th>
                                    <th
                                        scope="col"
                                        className="py-2 pr-3 font-medium"
                                    >
                                        Thématique
                                    </th>
                                    <th
                                        scope="col"
                                        className="py-2 font-medium"
                                    >
                                        Score sur 100
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-border">
                                    <th
                                        scope="row"
                                        className="py-2 pr-3 font-medium"
                                        colSpan={2}
                                    >
                                        Score global
                                    </th>
                                    <td className="py-2">
                                        {global ?? "Non concerné"}
                                    </td>
                                </tr>
                                {pillars.flatMap((pillar) => [
                                    <tr
                                        key={pillar.id}
                                        className="border-b border-border"
                                    >
                                        <th
                                            scope="row"
                                            className="py-2 pr-3 font-medium"
                                        >
                                            {pillar.label}
                                        </th>
                                        <td className="py-2 pr-3 text-ink-muted">
                                            Ensemble du domaine
                                        </td>
                                        <td className="py-2">
                                            {score.pillars[pillar.id] == null
                                                ? "Non concerné"
                                                : roundScore(
                                                      score.pillars[
                                                          pillar.id
                                                      ] as number,
                                                  )}
                                        </td>
                                    </tr>,
                                    ...pillar.themes.map((theme) => (
                                        <tr
                                            key={`${pillar.id}-${theme.id}`}
                                            className="border-b border-border"
                                        >
                                            <th
                                                scope="row"
                                                className="py-2 pr-3 font-normal text-ink-muted"
                                            >
                                                {pillar.label}
                                            </th>
                                            <td className="py-2 pr-3">
                                                {theme.label}
                                            </td>
                                            <td className="py-2">
                                                {score.themes[theme.id] == null
                                                    ? "Non concerné"
                                                    : roundScore(
                                                          score.themes[
                                                              theme.id
                                                          ] as number,
                                                      )}
                                            </td>
                                        </tr>
                                    )),
                                ])}
                            </tbody>
                        </table>
                    </details>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-muted">
                    Questionnaire {result.questionnaireVersion}
                    {score.algoVersion &&
                        ` · méthode de calcul ${score.algoVersion}`}
                </p>
                {canEdit && (
                    <Button asChild variant="outline">
                        <Link href="/diagnostic">
                            <RotateCcw aria-hidden="true" />
                            Refaire un diagnostic
                        </Link>
                    </Button>
                )}
            </div>
        </div>
    );
}

/** No submitted diagnostic yet. */
export function NoResult({ canEdit }: { canEdit: boolean }) {
    return (
        <Card tone="brand">
            <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <ClipboardCheck aria-hidden="true" className="size-8" />
                <div className="flex flex-1 flex-col gap-1">
                    <h2 className="text-lg font-semibold">
                        Aucun score pour l&apos;instant
                    </h2>
                    <p className="text-white/85">
                        Le score est calculé quand un diagnostic est validé.
                    </p>
                </div>
                {canEdit && (
                    <Button asChild variant="highlight">
                        <Link href="/diagnostic">Faire le diagnostic</Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
