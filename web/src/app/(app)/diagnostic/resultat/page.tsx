import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";

import { NoResult, ResultView } from "@/components/diagnostic/result-view";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, canEdit } from "@/lib/api";

export const metadata: Metadata = { title: "Résultat du diagnostic" };

/** Score of the latest submitted diagnostic (US-06), with its PDF (US-07). */
async function ResultContent() {
    const [user, questionnaire, result, current] = await Promise.all([
        api.getCurrentUser(),
        api.getQuestionnaire(),
        api.getLatestResult(),
        api.getCurrentDiagnostic(),
    ]);

    return result === null ? (
        <NoResult canEdit={canEdit(user.role)} />
    ) : (
        <ResultView
            result={result}
            questionnaire={questionnaire}
            canEdit={canEdit(user.role)}
            hasDraft={current.draft !== null}
        />
    );
}

function ResultSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Skeleton className="h-80 rounded-lg" />
                <Skeleton className="h-80 rounded-lg" />
            </div>
            <Skeleton className="h-48 rounded-lg" />
        </div>
    );
}

export default function ResultPage() {
    return (
        <>
            <PageHeader
                title="Résultat du diagnostic"
                description="Votre score sur les quatre domaines QHSE et les points à améliorer en priorité."
                action={
                    <Button asChild variant="outline">
                        <Link href="/diagnostic/historique">
                            <History aria-hidden="true" />
                            Historique des diagnostics
                        </Link>
                    </Button>
                }
            />
            <Suspense fallback={<ResultSkeleton />}>
                <ResultContent />
            </Suspense>
        </>
    );
}
