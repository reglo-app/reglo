"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { Download, Paperclip, Search, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EvidenceDocument } from "@/lib/api/types";
import type { DocumentActionResult } from "@/lib/documents/actions";
import { formatLabel } from "@/lib/documents/documents";
import { formatDate } from "@/lib/format";

import { DocumentViewer } from "./document-viewer";

export type LinkedDocumentsProps = {
    /** Documents already linked, latest first. */
    documents: EvidenceDocument[];
    /** Every document of the organization, to choose from. */
    available: EvidenceDocument[];
    /** What the documents prove, in the labels: "cette action". */
    subject: string;
    /** Administrators and members; readers only consult. */
    canEdit: boolean;
    link: (documentId: string) => Promise<DocumentActionResult>;
    unlink: (documentId: string) => Promise<DocumentActionResult>;
};

/**
 * The evidence of an action or of a question of the diagnostic (US-12):
 * shown and downloaded by everyone, linked and unlinked by administrators
 * and members. Unlinking keeps the document in the list of the
 * organization.
 */
export function LinkedDocuments({
    documents,
    available,
    subject,
    canEdit,
    link,
    unlink,
}: LinkedDocumentsProps) {
    const [isPending, startTransition] = useTransition();

    function remove(document: EvidenceDocument) {
        startTransition(async () => {
            const result = await unlink(document.id);
            if ("error" in result) toast.error(result.error);
            else toast.success(`« ${document.name} » n'est plus rattaché.`);
        });
    }

    return (
        <div className="flex flex-col gap-3">
            {documents.length === 0 ? (
                <p className="text-ink-muted">
                    Aucun justificatif rattaché à {subject}.
                </p>
            ) : (
                <ul className="flex flex-col divide-y divide-border">
                    {documents.map((document) => (
                        <li
                            key={document.id}
                            className="flex flex-col gap-2 py-2.5 first:pt-0 sm:flex-row sm:items-center"
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <DocumentViewer document={document} />
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                                    <Badge variant="outline">
                                        {formatLabel(document.mimeType)}
                                    </Badge>
                                    <span>
                                        {formatDate(document.createdAt)}
                                    </span>
                                </span>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                                <Button asChild variant="outline" size="row">
                                    <a
                                        href={`/document-files/${document.id}`}
                                        aria-label={`Télécharger ${document.name}`}
                                    >
                                        <Download aria-hidden="true" />
                                        Télécharger
                                    </a>
                                </Button>
                                {canEdit && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="row"
                                        disabled={isPending}
                                        onClick={() => remove(document)}
                                        aria-label={`Retirer ${document.name}`}
                                    >
                                        <Unlink aria-hidden="true" />
                                        Retirer
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {canEdit && (
                <DocumentPicker
                    documents={available.filter(
                        (document) =>
                            !documents.some(
                                (linked) => linked.id === document.id,
                            ),
                    )}
                    subject={subject}
                    link={link}
                />
            )}
        </div>
    );
}

/** "Joindre un justificatif": chooses among the documents of the organization. */
function DocumentPicker({
    documents,
    subject,
    link,
}: {
    documents: EvidenceDocument[];
    subject: string;
    link: (documentId: string) => Promise<DocumentActionResult>;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [isPending, startTransition] = useTransition();
    const searchId = useId();
    const found = documents.filter((document) =>
        document.name.toLowerCase().includes(query.trim().toLowerCase()),
    );

    function choose(document: EvidenceDocument) {
        startTransition(async () => {
            const result = await link(document.id);
            if ("error" in result) {
                toast.error(result.error);
            } else {
                toast.success(
                    `« ${document.name} » est rattaché à ${subject}.`,
                );
                setOpen(false);
            }
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (next) setQuery("");
            }}
        >
            <DialogTrigger asChild>
                <Button type="button" variant="outline" className="w-fit">
                    <Paperclip aria-hidden="true" />
                    Joindre un justificatif
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Joindre un justificatif</DialogTitle>
                    <DialogDescription>
                        Choisissez un des justificatifs de votre organisation
                        pour le rattacher à {subject}.
                    </DialogDescription>
                </DialogHeader>
                {documents.length === 0 ? (
                    <p className="text-ink-muted">
                        Tous vos justificatifs sont déjà rattachés, ou vous
                        n&apos;en avez pas encore.
                    </p>
                ) : (
                    <>
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor={searchId}
                                className="text-sm font-medium"
                            >
                                Rechercher par nom
                            </label>
                            <div className="relative">
                                <Search
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
                                />
                                <Input
                                    id={searchId}
                                    type="search"
                                    value={query}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <p role="status" className="sr-only">
                            {`${found.length} justificatif${found.length > 1 ? "s" : ""}`}
                        </p>
                        {found.length === 0 ? (
                            <p className="text-ink-muted">
                                Aucun justificatif ne correspond à «{" "}
                                {query.trim()} ».
                            </p>
                        ) : (
                            <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto">
                                {found.map((document) => (
                                    <li
                                        key={document.id}
                                        className="flex items-center gap-3 py-2"
                                    >
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="font-medium break-words text-ink">
                                                {document.name}
                                            </span>
                                            <span className="text-sm text-ink-muted">
                                                {formatLabel(document.mimeType)}{" "}
                                                ·{" "}
                                                {formatDate(document.createdAt)}
                                            </span>
                                        </span>
                                        <Button
                                            type="button"
                                            size="row"
                                            disabled={isPending}
                                            onClick={() => choose(document)}
                                            aria-label={`Joindre ${document.name}`}
                                        >
                                            Joindre
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
                <p className="text-sm text-ink-muted">
                    Le document n&apos;est pas dans la liste ?{" "}
                    <Link
                        href="/documents"
                        className="link-underline text-green-700"
                    >
                        Déposez-le dans vos justificatifs
                    </Link>
                    , puis revenez le joindre.
                </p>
            </DialogContent>
        </Dialog>
    );
}
