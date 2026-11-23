import { Suspense } from "react";
import type { Metadata } from "next";

import { DocumentFilters } from "@/components/documents/document-filters";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, canEdit } from "@/lib/api";
import {
    hasDocumentFilters,
    parseDocumentFilters,
} from "@/lib/documents/filters";

export const metadata: Metadata = { title: "Justificatifs" };

type SearchParams = PageProps<"/documents">["searchParams"];

/** Evidence documents of the organization (US-11), with filters (US-12). */
async function DocumentsContent({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const [user, members, params] = await Promise.all([
        api.getCurrentUser(),
        api.getMembers(),
        searchParams,
    ]);
    const filters = parseDocumentFilters(
        params,
        members.map((member) => member.id),
    );
    const documents = await api.getDocuments(filters);
    const editable = canEdit(user.role);
    const filtered = hasDocumentFilters(filters);

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
                {documents.length === 0 && !filtered ? (
                    <DocumentList documents={documents} user={user} />
                ) : (
                    <section
                        aria-labelledby="documents-list-title"
                        className="flex flex-col gap-4"
                    >
                        <h2
                            id="documents-list-title"
                            className="text-lg font-semibold"
                        >
                            Justificatifs de l&apos;organisation
                        </h2>
                        <DocumentFilters
                            filters={filters}
                            authors={members.filter(
                                (member) =>
                                    member.activated ||
                                    member.id === filters.author,
                            )}
                            count={documents.length}
                        />
                        {documents.length === 0 ? (
                            <Card>
                                <CardContent className="py-8 text-center text-ink-muted">
                                    Aucun justificatif ne correspond à ces
                                    filtres.
                                </CardContent>
                            </Card>
                        ) : (
                            <DocumentList documents={documents} user={user} />
                        )}
                    </section>
                )}
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

export default function DocumentsPage({
    searchParams,
}: PageProps<"/documents">) {
    // Reading the URL inside Suspense keeps navigation instant.
    return (
        <Suspense fallback={<DocumentsSkeleton />}>
            <DocumentsContent searchParams={searchParams} />
        </Suspense>
    );
}
