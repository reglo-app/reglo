"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, ExternalLink, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import type { EvidenceDocument } from "@/lib/api/types";
import { CSV_PREVIEW_MAX_ROWS, decodeCsv, parseCsv } from "@/lib/documents/csv";
import {
    CSV_PREVIEW_MAX_BYTES,
    formatFileSize,
    formatLabel,
    previewKind,
} from "@/lib/documents/documents";

/**
 * The name of a document: a click shows it, without leaving the list. Loaded
 * only then, through the web server (document-files), like a download.
 */
export function DocumentViewer({ document }: { document: EvidenceDocument }) {
    const kind = previewKind(document.mimeType);
    const fileUrl = `/document-files/${document.id}`;
    const viewUrl = `${fileUrl}?view=1`;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="link-underline w-fit cursor-pointer text-left font-medium break-words text-ink"
                    aria-label={`Voir ${document.name}`}
                >
                    {document.name}
                </button>
            </DialogTrigger>
            <DialogContent
                className="flex h-[85dvh] flex-col sm:max-w-5xl"
                // Focus on the dialog, not in the PDF viewer: inside it, the
                // Escape key and the Tab key would stay with the viewer.
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    (event.currentTarget as HTMLElement | null)?.focus();
                }}
            >
                <DialogHeader>
                    <DialogTitle className="break-words">
                        {document.name}
                    </DialogTitle>
                    <DialogDescription>
                        {formatLabel(document.mimeType)},{" "}
                        {formatFileSize(document.size)}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-surface-subtle">
                    {kind === "pdf" && (
                        <div className="relative size-full">
                            {/* Covered by the PDF once the browser shows it. */}
                            <p className="absolute inset-0 flex items-center justify-center text-ink-muted">
                                Chargement de l&apos;aperçu…
                            </p>
                            <iframe
                                src={viewUrl}
                                title={`Aperçu de ${document.name}`}
                                className="relative size-full"
                            />
                        </div>
                    )}
                    {kind === "image" && (
                        <div className="relative size-full">
                            <Image
                                src={viewUrl}
                                alt={`Aperçu de ${document.name}`}
                                fill
                                unoptimized
                                className="object-contain"
                            />
                        </div>
                    )}
                    {kind === "csv" && (
                        <CsvPreview fileUrl={fileUrl} document={document} />
                    )}
                    {kind === null && (
                        <NoPreview>
                            Ce format ne peut pas être affiché ici. Téléchargez
                            le fichier pour l&apos;ouvrir.
                        </NoPreview>
                    )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    {(kind === "pdf" || kind === "image") && (
                        <>
                            <p className="text-sm text-ink-muted sm:mr-auto">
                                L&apos;aperçu ne s&apos;affiche pas ? Ouvrez le
                                fichier dans un nouvel onglet ou téléchargez-le.
                            </p>
                            <Button asChild variant="outline">
                                <a
                                    href={viewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink aria-hidden="true" />
                                    Nouvel onglet
                                    <span className="sr-only">
                                        {" "}
                                        (s&apos;ouvre dans un nouvel onglet)
                                    </span>
                                </a>
                            </Button>
                        </>
                    )}
                    <Button asChild>
                        <a href={fileUrl}>
                            <Download aria-hidden="true" />
                            Télécharger
                        </a>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function NoPreview({ children }: { children: React.ReactNode }) {
    return (
        <p className="flex size-full items-center justify-center p-6 text-center text-ink-muted">
            {children}
        </p>
    );
}

type CsvState =
    | { status: "loading" }
    | { status: "failed" }
    | { status: "ready"; rows: string[][]; truncated: boolean };

/** A CSV file as a table: its values are only ever shown as text. */
function CsvPreview({
    fileUrl,
    document,
}: {
    fileUrl: string;
    document: EvidenceDocument;
}) {
    const tooLarge = document.size > CSV_PREVIEW_MAX_BYTES;
    const [state, setState] = useState<CsvState>({ status: "loading" });

    useEffect(() => {
        if (tooLarge) return;

        const controller = new AbortController();
        fetch(fileUrl, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error("Not available");
                return response.arrayBuffer();
            })
            .then((bytes) =>
                setState({ status: "ready", ...parseCsv(decodeCsv(bytes)) }),
            )
            .catch(() => {
                if (!controller.signal.aborted) setState({ status: "failed" });
            });

        return () => controller.abort();
    }, [fileUrl, tooLarge]);

    if (tooLarge) {
        return (
            <NoPreview>
                Ce tableau est trop volumineux pour être affiché ici.
                Téléchargez le fichier pour l&apos;ouvrir.
            </NoPreview>
        );
    }
    if (state.status === "loading") {
        return (
            <NoPreview>
                <LoaderCircle
                    aria-hidden="true"
                    className="mr-2 size-4 animate-spin"
                />
                Chargement de l&apos;aperçu…
            </NoPreview>
        );
    }
    if (state.status === "failed") {
        return (
            <NoPreview>
                L&apos;aperçu n&apos;a pas pu être chargé. Réessayez, ou
                téléchargez le fichier.
            </NoPreview>
        );
    }
    if (state.rows.length === 0) {
        return <NoPreview>Ce tableau est vide.</NoPreview>;
    }

    const [header, ...rows] = state.rows;
    return (
        // Scrolled with the arrow keys too: it can take the focus.
        <div
            tabIndex={0}
            role="region"
            aria-label={`Contenu de ${document.name}`}
            className="size-full overflow-auto bg-white"
        >
            {state.truncated && (
                <p className="sticky left-0 border-b border-border bg-surface-subtle px-3 py-2 text-sm text-ink-muted">
                    Seules les {CSV_PREVIEW_MAX_ROWS} premières lignes sont
                    affichées. Téléchargez le fichier pour tout voir.
                </p>
            )}
            <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">{document.name}</caption>
                <thead>
                    <tr className="border-b border-border-strong">
                        {header.map((cell, index) => (
                            <th
                                key={index}
                                scope="col"
                                className="px-3 py-2 font-semibold whitespace-nowrap"
                            >
                                {cell}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-border">
                            {row.map((cell, index) => (
                                <td key={index} className="px-3 py-2">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
