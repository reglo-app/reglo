import { Suspense } from "react";
import type { Metadata } from "next";

import { DiagnosticHistory } from "@/components/diagnostic/diagnostic-history";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api, canEdit } from "@/lib/api";

export const metadata: Metadata = { title: "Historique des diagnostics" };

/** The submitted diagnostics of the organization (US-07). */
async function HistoryContent() {
    const [user, diagnostics] = await Promise.all([
        api.getCurrentUser(),
        api.getDiagnosticHistory(),
    ]);

    return (
        <DiagnosticHistory
            diagnostics={diagnostics}
            canEdit={canEdit(user.role)}
        />
    );
}

export default function DiagnosticHistoryPage() {
    return (
        <>
            <PageHeader
                title="Historique des diagnostics"
                description="Chaque diagnostic validé, avec son score et sa synthèse : suivez votre progression."
            />
            <Suspense
                fallback={
                    <div aria-busy="true">
                        <span className="sr-only">Chargement…</span>
                        <Skeleton className="h-64 rounded-lg" />
                    </div>
                }
            >
                <HistoryContent />
            </Suspense>
        </>
    );
}
