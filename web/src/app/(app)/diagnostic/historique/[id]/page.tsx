import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResultView } from "@/components/diagnostic/result-view";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api, canEdit } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Params = PageProps<"/diagnostic/historique/[id]">["params"];

export async function generateMetadata({
    params,
}: PageProps<"/diagnostic/historique/[id]">): Promise<Metadata> {
    const { id } = await params;
    const result = await api.getDiagnosticResult(id);
    return {
        title: result
            ? `Diagnostic du ${formatDate(result.submittedAt)}`
            : "Diagnostic",
    };
}

/** The result of one diagnostic of the history (US-07). */
async function PastResultContent({ params }: { params: Params }) {
    const { id } = await params;
    const [user, questionnaire, result, current] = await Promise.all([
        api.getCurrentUser(),
        api.getQuestionnaire(),
        api.getDiagnosticResult(id),
        api.getCurrentDiagnostic(),
    ]);
    if (!result) {
        notFound();
    }

    return (
        <>
            <PageHeader
                title={`Diagnostic du ${formatDate(result.submittedAt)}`}
                description="Le score de ce diagnostic et les points qui étaient à améliorer en priorité."
            />
            <ResultView
                result={result}
                questionnaire={questionnaire}
                canEdit={canEdit(user.role)}
                hasDraft={current.draft !== null}
            />
        </>
    );
}

export default function PastResultPage({
    params,
}: PageProps<"/diagnostic/historique/[id]">) {
    // Reading the URL params inside Suspense keeps navigation instant.
    return (
        <Suspense
            fallback={
                <div className="flex flex-col gap-6" aria-busy="true">
                    <span className="sr-only">Chargement…</span>
                    <Skeleton className="h-10 w-1/2" />
                    <Skeleton className="h-80 rounded-lg" />
                </div>
            }
        >
            <PastResultContent params={params} />
        </Suspense>
    );
}
