"use client";

import { useState, useTransition } from "react";
import { CircleAlert, History, LoaderCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { personName } from "@/lib/action-plan/labels";
import type { DocumentAccess, DocumentAccessKind } from "@/lib/api/types";
import { loadDocumentAccesses } from "@/lib/documents/actions";

const KIND_LABELS: Record<DocumentAccessKind, string> = {
    download: "Téléchargé",
    view: "Consulté",
};

const dateTime = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
});

/**
 * "Historique": who opened the document and when (US-12). Administrators
 * only; loaded when the dialog opens.
 */
export function AccessHistoryButton({
    documentId,
    name,
    load = loadDocumentAccesses,
}: {
    documentId: string;
    name: string;
    /** Injected in tests; the server action by default. */
    load?: typeof loadDocumentAccesses;
}) {
    const [accesses, setAccesses] = useState<DocumentAccess[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();

    function open(next: boolean) {
        if (!next) return;
        setError(null);
        startLoading(async () => {
            const result = await load(documentId);
            if ("error" in result) {
                setError(result.error);
                setAccesses(null);
            } else {
                setAccesses(result.accesses);
            }
        });
    }

    return (
        <Dialog onOpenChange={open}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="row"
                    aria-label={`Historique des accès à ${name}`}
                >
                    <History aria-hidden="true" />
                    Historique
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Historique des accès</DialogTitle>
                    <DialogDescription className="break-words">
                        Qui a téléchargé ou consulté « {name} », du plus récent
                        au plus ancien.
                    </DialogDescription>
                </DialogHeader>
                {isLoading ? (
                    <p
                        className="flex items-center gap-2 text-ink-muted"
                        aria-busy="true"
                    >
                        <LoaderCircle
                            aria-hidden="true"
                            className="size-4 animate-spin"
                        />
                        Chargement…
                    </p>
                ) : error ? (
                    <Alert variant="destructive">
                        <CircleAlert aria-hidden="true" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : accesses?.length === 0 ? (
                    <p className="text-ink-muted">
                        Personne ne l&apos;a encore ouvert.
                    </p>
                ) : (
                    <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto">
                        {accesses?.map((access, index) => (
                            <li
                                key={`${access.at}-${index}`}
                                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2"
                            >
                                <span>
                                    <span className="font-medium text-ink">
                                        {access.by
                                            ? personName(access.by)
                                            : "Ancien membre"}
                                    </span>{" "}
                                    <span className="text-ink-muted">
                                        · {KIND_LABELS[access.kind]}
                                    </span>
                                </span>
                                <time
                                    dateTime={access.at}
                                    className="text-sm text-ink-muted"
                                >
                                    {dateTime.format(new Date(access.at))}
                                </time>
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}
