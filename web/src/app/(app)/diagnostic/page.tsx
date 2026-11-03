import { Suspense } from "react";
import type { Metadata } from "next";

import { DiagnosticWizard } from "@/components/diagnostic/diagnostic-wizard";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api, canEdit } from "@/lib/api";

export const metadata: Metadata = { title: "Diagnostic" };

/** QHSE diagnostic (US-05): the shared draft of the organization. */
async function DiagnosticContent() {
    const [user, questionnaire, current] = await Promise.all([
        api.getCurrentUser(),
        api.getQuestionnaire(),
        api.getCurrentDiagnostic(),
    ]);

    return (
        <DiagnosticWizard
            questionnaire={questionnaire}
            current={current}
            canEdit={canEdit(user.role)}
        />
    );
}

function DiagnosticSkeleton() {
    return (
        <div
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
            aria-busy="true"
        >
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-[32rem] rounded-xl" />
            <Skeleton className="hidden h-96 rounded-xl lg:block" />
        </div>
    );
}

export default function DiagnosticPage() {
    return (
        <>
            <PageHeader
                title="Diagnostic"
                description="Évaluez votre entreprise sur les quatre domaines QHSE."
            />
            <Suspense fallback={<DiagnosticSkeleton />}>
                <DiagnosticContent />
            </Suspense>
        </>
    );
}
