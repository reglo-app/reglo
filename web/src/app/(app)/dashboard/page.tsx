import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Suspense } from "react";

import {
    AlertsCard,
    NewsCard,
    UpcomingActionsCard,
} from "@/components/dashboard/dashboard-lists";
import { ScoreOverview } from "@/components/dashboard/score-overview";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, canEdit } from "@/lib/api";
import { withDiagnosticScore } from "@/lib/diagnostic/result";

export const metadata: Metadata = { title: "Tableau de bord" };

/**
 * Home page: four blocks, each answering one question (score, alerts,
 * next actions, regulatory news). Kept short on purpose.
 */
async function DashboardContent() {
    const [mockedSummary, result, current] = await Promise.all([
        api.getDashboardSummary(),
        api.getLatestResult(),
        api.getCurrentDiagnostic(),
    ]);
    // The score block shows the real score of the latest diagnostic (US-06).
    const summary = withDiagnosticScore(mockedSummary, result);
    const today = summary.generatedAt;

    return (
        <div className="flex flex-col gap-4">
            <ScoreOverview
                summary={summary}
                hasDraft={current.draft !== null}
            />
            <div className="grid gap-4 lg:grid-cols-2">
                <AlertsCard alerts={summary.alerts} today={today} />
                <UpcomingActionsCard
                    actions={summary.upcomingActions}
                    onTimeRate={summary.actionsOnTimeRate}
                    today={today}
                />
            </div>
            <NewsCard news={summary.latestNews} />
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-44 rounded-lg" />
            <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-64 rounded-lg" />
                <Skeleton className="h-64 rounded-lg" />
            </div>
            <Skeleton className="h-80 rounded-lg" />
        </div>
    );
}

/** Hidden for readers (US-16): they only consult. */
async function DiagnosticAction() {
    const [user, current] = await Promise.all([
        api.getCurrentUser(),
        api.getCurrentDiagnostic(),
    ]);
    if (!canEdit(user.role)) return null;

    return (
        <Button asChild className="transition duration-200">
            <Link href="/diagnostic">
                {current.draft ? (
                    <>
                        Poursuivre le diagnostic
                        <ArrowRight aria-hidden="true" />
                    </>
                ) : (
                    <>
                        <Plus aria-hidden="true" />
                        Faire un diagnostic
                    </>
                )}
            </Link>
        </Button>
    );
}

export default function DashboardPage() {
    return (
        <>
            <PageHeader
                title="Tableau de bord"
                description="Votre situation sur les quatre domaines QHSE."
                action={
                    <Suspense fallback={null}>
                        <DiagnosticAction />
                    </Suspense>
                }
            />
            <Suspense fallback={<DashboardSkeleton />}>
                <DashboardContent />
            </Suspense>
        </>
    );
}
