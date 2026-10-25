import Link from "next/link";
import { ClipboardCheck, FileWarning, Gauge, ListChecks } from "lucide-react";

import { BlockHeader, EmptyLine } from "@/components/dashboard/block";
import { ScoreRing, Trend, scoreLevel } from "@/components/score";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ActionSummary, DomainDetail, ExpiringDocument } from "@/lib/api";
import {
    DOMAIN_FILL_CLASSES,
    DOMAIN_STROKE_CLASSES,
    DOMAIN_TINT_CLASSES,
    DOMAINS,
    type DomainKey,
} from "@/lib/domains";
import { daysUntil, formatDueIn } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Blocks 1 and 2: the pillar score (ring in the domain colour, level,
 * trend) and its score per diagnostic theme, weakest first.
 */
export function DomainScoreCard({ detail }: { detail: DomainDetail }) {
    const { label } = DOMAINS[detail.domain];

    if (detail.score === null) {
        return (
            <Card tone="brand">
                <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <ClipboardCheck aria-hidden="true" className="size-8" />
                    <h2 className="flex-1 text-lg font-semibold">
                        Faites le diagnostic pour obtenir votre score {label}
                    </h2>
                    <Button asChild variant="highlight">
                        <Link href="/diagnostic">Commencer</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const themes = [...detail.themes].sort((a, b) => a.score - b.score);
    const weakest = themes[0];

    return (
        <Card>
            <BlockHeader icon={Gauge} title={`Score ${label}`} />
            <CardContent className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div
                    className={cn(
                        "flex flex-col items-center justify-center gap-3 rounded-lg p-6 text-ink",
                        DOMAIN_TINT_CLASSES[detail.domain],
                    )}
                >
                    <ScoreRing
                        score={detail.score}
                        label={`Score ${label} : ${detail.score} sur 100`}
                        trackClassName="stroke-white"
                        valueClassName={DOMAIN_STROKE_CLASSES[detail.domain]}
                        unitClassName="text-ink-muted"
                    />
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">
                        {scoreLevel(detail.score)}
                    </span>
                    <Trend
                        score={detail.score}
                        previousScore={detail.previousScore}
                    />
                </div>

                <div className="flex flex-col justify-center gap-1">
                    <h3 className="mb-2 text-sm font-semibold text-ink">
                        Score par thème
                    </h3>
                    <ul className="flex flex-col gap-3">
                        {themes.map((theme) => (
                            <ThemeRow
                                key={theme.id}
                                domain={detail.domain}
                                label={theme.label}
                                score={theme.score}
                                weakest={theme.id === weakest?.id}
                            />
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}

function ThemeRow({
    domain,
    label,
    score,
    weakest,
}: {
    domain: DomainKey;
    label: string;
    score: number;
    weakest: boolean;
}) {
    return (
        <li className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-sm text-ink">
                <span className="flex-1">{label}</span>
                {weakest && <Badge variant="warning">Priorité</Badge>}
                <span className="w-8 text-right font-semibold">
                    {score}
                    <span className="sr-only"> sur 100</span>
                </span>
            </span>
            {/* Decorative: the number above says the same thing. */}
            <span
                aria-hidden="true"
                className="h-1.5 overflow-hidden rounded-full bg-surface-subtle"
            >
                <span
                    className={cn(
                        "block h-full rounded-full",
                        DOMAIN_FILL_CLASSES[domain],
                    )}
                    style={{ width: `${score}%` }}
                />
            </span>
        </li>
    );
}

/** Due label as a badge: red when late, yellow within 30 days, grey after. */
function DueBadge({ date, today }: { date: string; today: string }) {
    const days = daysUntil(date, today);
    const variant =
        days < 0 ? "destructive" : days <= 30 ? "warning" : "secondary";
    return <Badge variant={variant}>{formatDueIn(date, today)}</Badge>;
}

/** Block 3: open actions of the pillar, soonest (or latest) first. */
export function DomainActionsCard({
    actions,
    today,
}: {
    actions: ActionSummary[];
    today: string;
}) {
    return (
        <Card>
            <BlockHeader
                icon={ListChecks}
                title="Actions en cours"
                seeAll={{ href: "/actions", label: "plan d'actions" }}
            />
            <CardContent>
                {actions.length === 0 ? (
                    <EmptyLine>
                        Aucune action en cours sur ce domaine.
                    </EmptyLine>
                ) : (
                    <ul className="divide-y divide-border">
                        {actions.slice(0, 5).map((action) => (
                            <li
                                key={action.id}
                                className="flex items-center gap-3 py-2.5"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-ink">
                                        {action.title}
                                    </p>
                                    <p className="text-xs text-ink-muted">
                                        {action.ownerName}
                                    </p>
                                </div>
                                <DueBadge date={action.dueDate} today={today} />
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}

/** Block 4: evidence documents of the pillar that expire soon or have. */
export function ExpiringDocumentsCard({
    documents,
    today,
}: {
    documents: ExpiringDocument[];
    today: string;
}) {
    return (
        <Card>
            <BlockHeader
                icon={FileWarning}
                title="Justificatifs à renouveler"
                seeAll={{ href: "/documents", label: "justificatifs" }}
            />
            <CardContent>
                {documents.length === 0 ? (
                    <EmptyLine>Aucun justificatif à renouveler.</EmptyLine>
                ) : (
                    <ul className="divide-y divide-border">
                        {documents.map((document) => (
                            <li
                                key={document.id}
                                className="flex items-center gap-3 py-2.5"
                            >
                                <p className="min-w-0 flex-1 truncate text-sm text-ink">
                                    {document.title}
                                </p>
                                <DueBadge
                                    date={document.dueDate}
                                    today={today}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
