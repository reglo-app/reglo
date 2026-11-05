"use client";

import { useState, useTransition } from "react";
import { CircleAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { deleteDocument } from "@/lib/documents/actions";

/** "Supprimer", confirmed in a dialog. */
export function DeleteDocumentButton({
    documentId,
    name,
    remove = deleteDocument,
}: {
    documentId: string;
    name: string;
    /** Injected in tests; the server action by default. */
    remove?: typeof deleteDocument;
}) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function confirm() {
        setError(null);
        startTransition(async () => {
            const result = await remove(documentId);
            if ("error" in result) {
                setError(result.error);
            } else {
                setOpen(false);
                toast.success(`« ${name} » est supprimé.`);
            }
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                setError(null);
            }}
        >
            <DialogTrigger asChild>
                <Button
                    variant="destructive-outline"
                    size="row"
                    aria-label={`Supprimer ${name}`}
                >
                    <Trash2 aria-hidden="true" />
                    Supprimer
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Supprimer ce justificatif ?</DialogTitle>
                    <DialogDescription>
                        « {name} » sera supprimé définitivement.
                    </DialogDescription>
                </DialogHeader>
                {error && (
                    <Alert variant="destructive">
                        <CircleAlert aria-hidden="true" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isPending}>
                            Annuler
                        </Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={isPending}
                        onClick={confirm}
                    >
                        {isPending
                            ? "Suppression…"
                            : "Supprimer le justificatif"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
