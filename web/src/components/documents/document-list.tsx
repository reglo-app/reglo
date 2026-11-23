import Link from "next/link";
import { Download, FileText, ListChecks, ClipboardCheck } from "lucide-react";

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

import { AccessHistoryButton } from "./access-history";
import { DeleteDocumentButton } from "./delete-document-button";
import { DocumentViewer } from "./document-viewer";

/**
 * Documents of the organization (US-11), with what each one proves and,
 * for administrators, who opened it (US-12).
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
            <ul aria-label="Justificatifs" className="divide-y divide-border">
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
                            <DocumentLinks document={document} />
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
                            {user.role === "admin" && (
                                <AccessHistoryButton
                                    documentId={document.id}
                                    name={document.name}
                                />
                            )}
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

/** The actions and questions of the diagnostic a document proves. */
export function DocumentLinks({ document }: { document: EvidenceDocument }) {
    if (document.actions.length === 0 && document.questions.length === 0) {
        return null;
    }

    return (
        <ul
            aria-label={`Ce que prouve ${document.name}`}
            className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
        >
            {document.actions.map((action) => (
                <li
                    key={`action-${action.id}`}
                    className="flex min-w-0 gap-1.5"
                >
                    <ListChecks
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-green-700"
                    />
                    <span className="min-w-0">
                        <span className="text-ink-muted">Action : </span>
                        <Link
                            href={`/actions/${action.id}`}
                            className="link-underline text-green-700"
                        >
                            {action.title}
                        </Link>
                    </span>
                </li>
            ))}
            {document.questions.map((question) => (
                <li
                    key={`question-${question.id}`}
                    className="flex min-w-0 gap-1.5"
                >
                    <ClipboardCheck
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-green-700"
                    />
                    <span className="min-w-0">
                        <span className="text-ink-muted">Question : </span>
                        {question.label}
                    </span>
                </li>
            ))}
        </ul>
    );
}
