import { Suspense } from "react";
import type { Metadata } from "next";

import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, canEdit } from "@/lib/api";

export const metadata: Metadata = { title: "Justificatifs" };

/** Evidence documents of the organization (US-11). */
async function DocumentsContent() {
    const [user, documents] = await Promise.all([
        api.getCurrentUser(),
        api.getDocuments(),
    ]);
    const editable = canEdit(user.role);

    return (
        <>
            <PageHeader
                title="Justificatifs"
                description={
                    editable
                        ? "Centralisez les preuves de votre conformité. Seules les personnes de votre organisation y ont accès."
                        : "Les preuves de la conformité de votre organisation. En lecture seule, vous les consultez et les téléchargez."
                }
            />
            <div className="flex flex-col gap-6">
                {editable && (
                    <Card>
                        <CardContent className="flex flex-col gap-4">
                            <h2 className="text-lg font-semibold">
                                Déposer un justificatif
                            </h2>
                            <DocumentUploader />
                        </CardContent>
                    </Card>
                )}
                <DocumentList documents={documents} user={user} />
            </div>
        </>
    );
}

function DocumentsSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
        </div>
    );
}

export default function DocumentsPage() {
    return (
        <Suspense fallback={<DocumentsSkeleton />}>
            <DocumentsContent />
        </Suspense>
    );
}
