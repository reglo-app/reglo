import Link from "next/link";
import { ChevronRight, ClipboardCheck, Gauge } from "lucide-react";

import { BlockHeader } from "@/components/dashboard/block";
import { ScoreRing, Trend, scoreLevel } from "@/components/score";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardSummary, DomainScore } from "@/lib/api";
import {
    DOMAIN_FILL_CLASSES,
    DOMAIN_ICON_CLASSES,
    DOMAINS,
} from "@/lib/domains";
import { cn } from "@/lib/utils";

/** One QHSE pillar: name, score, trend and a bar in its colour. */
function DomainTile(score: DomainScore) {
    const { label, icon: Icon } = DOMAINS[score.domain];
    return (
        <li className="flex">
            <Link
                href={`/domains/${score.domain}`}
                className="group flex flex-1 flex-col justify-between gap-3 rounded-lg border border-border p-4 transition-colors hover:border-border-strong hover:bg-green-50"
            >
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <Icon
                        aria-hidden="true"
                        className={cn(
                            "size-5 shrink-0",
                            DOMAIN_ICON_CLASSES[score.domain],
                        )}
                    />
                    <span className="flex-1">{label}</span>
                    <ChevronRight
                        aria-hidden="true"
                        className="size-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
                    />
                </span>
                <span className="flex items-end justify-between gap-2">
                    <span className="text-3xl font-semibold text-ink">
                        {score.score}
                        <span className="sr-only"> sur 100</span>
                    </span>
                    <Trend
                        score={score.score}
                        previousScore={score.previousScore}
                    />
                </span>
                {/* Decorative: the number above says the same thing. */}
                <span
                    aria-hidden="true"
                    className="h-1.5 overflow-hidden rounded-full bg-surface-subtle"
                >
                    <span
                        className={cn(
                            "block h-full rounded-full",
                            DOMAIN_FILL_CLASSES[score.domain],
                        )}
                        style={{ width: `${score.score}%` }}
                    />
                </span>
            </Link>
        </li>
    );
}

/** Block 1, "Où en suis-je ?": global score ring on the left, pillars in a 2 × 2 grid. */
export function ScoreOverview({ summary }: { summary: DashboardSummary }) {
    if (summary.globalScore === null) {
        return (
            <Card tone="brand">
                <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <ClipboardCheck aria-hidden="true" className="size-8" />
                    <h2 className="flex-1 text-lg font-semibold">
                        Faites votre premier diagnostic
                    </h2>
                    <Button asChild variant="highlight">
                        <Link href="/diagnostic">Commencer</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const globalScore = summary.globalScore;

    return (
        <Card>
            <BlockHeader icon={Gauge} title="Score QHSE" />
            <CardContent className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                {/* Global score: ring on the brand gradient. */}
                <div className="relative isolate flex flex-col items-center justify-center gap-3 overflow-hidden rounded-lg bg-brand-gradient p-6 text-white">
                    <span
                        aria-hidden="true"
                        className="absolute -top-14 -right-14 -z-10 size-44 rounded-full bg-white/10"
                    />
                    <span className="text-sm font-semibold">Score global</span>
                    <ScoreRing
                        score={globalScore}
                        label={`Score global : ${globalScore} sur 100`}
                    />
                    <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
                        {scoreLevel(globalScore)}
                    </span>
                    <Trend
                        score={globalScore}
                        previousScore={summary.previousGlobalScore}
                        className="text-white"
                    />
                </div>

                {/* Detailed scores: the four pillars in a 2 × 2 grid that
                    fills the height of the global score panel. */}
                <ul className="grid gap-3 sm:grid-cols-2 sm:grid-rows-2">
                    {summary.domains.map((score) => (
                        <DomainTile key={score.domain} {...score} />
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

// Kept for existing imports.
export { scoreLevel };
