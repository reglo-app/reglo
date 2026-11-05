import { Download, FileText } from "lucide-react";

import { DomainBadge } from "@/components/domain-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { personName } from "@/lib/action-plan/labels";
import type { CurrentUser, EvidenceDocument } from "@/lib/api/types";
import {
    canDeleteDocument,
    formatFileSize,
    formatLabel,
} from "@/lib/documents/documents";
import { formatDate } from "@/lib/format";

import { DeleteDocumentButton } from "./delete-document-button";
import { DocumentViewer } from "./document-viewer";

/**
 * Documents of the organization, latest first (US-11). Filters and links to
 * the actions come with US-12.
 */
export function DocumentList({
    documents,
    user,
}: {
    documents: EvidenceDocument[];
    user: CurrentUser;
}) {
    if (documents.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                    <FileText
                        aria-hidden="true"
                        className="size-8 text-green-700"
                    />
                    <h2 className="text-lg font-semibold">
                        Aucun justificatif pour l&apos;instant
                    </h2>
                    <p className="max-w-md text-ink-muted">
                        DUERP, rapports de vérification, certificats,
                        procédures, registres : gardez ici ce qui prouve vos
                        pratiques lors d&apos;un audit.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="gap-0 py-0">
            <ul className="divide-y divide-border">
                {documents.map((document) => (
                    <li
                        key={document.id}
                        className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-6"
                    >
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <DocumentViewer document={document} />
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-muted">
                                <Badge variant="outline">
                                    {formatLabel(document.mimeType)}
                                </Badge>
                                {document.domain && (
                                    <DomainBadge domain={document.domain} />
                                )}
                                <span>{formatFileSize(document.size)}</span>
                                <span>{formatDate(document.createdAt)}</span>
                                <span>
                                    {document.uploadedBy
                                        ? personName(document.uploadedBy)
                                        : "Ancien membre"}
                                </span>
                            </span>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                            <Button asChild variant="outline" size="row">
                                {/* An attachment: the page stays open. */}
                                <a
                                    href={`/document-files/${document.id}`}
                                    aria-label={`Télécharger ${document.name}`}
                                >
                                    <Download aria-hidden="true" />
                                    Télécharger
                                </a>
                            </Button>
                            {canDeleteDocument(document, user) && (
                                <DeleteDocumentButton
                                    documentId={document.id}
                                    name={document.name}
                                />
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </Card>
    );
}
