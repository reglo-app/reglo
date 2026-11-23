"use client";

import { useState, useTransition } from "react";
import { CircleAlert, LoaderCircle, RotateCcw } from "lucide-react";

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
import { restartDiagnostic } from "@/lib/diagnostic/actions";

/**
 * "Refaire un diagnostic" (US-07), confirmed in a dialog: a new draft with
 * the answers of this diagnostic, which stays in the history. Opens the
 * questions once it is created.
 */
export function RestartDiagnosticButton({
    diagnosticId,
    restart = restartDiagnostic,
}: {
    diagnosticId: string;
    /** Injected in tests; the server action by default. */
    restart?: typeof restartDiagnostic;
}) {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function confirm() {
        setError(null);
        startTransition(async () => {
            // On success, the action opens the questions.
            const result = await restart(diagnosticId);
            if (result && "error" in result) setError(result.error);
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (isPending) return;
                setOpen(next);
                setError(null);
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline">
                    <RotateCcw aria-hidden="true" />
                    Refaire un diagnostic
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Refaire un diagnostic ?</DialogTitle>
                    <DialogDescription>
                        Le nouveau diagnostic reprend ces réponses : vous ne
                        changez que ce qui a évolué. Ce diagnostic et son score
                        restent dans l&apos;historique.
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
                    <Button disabled={isPending} onClick={confirm}>
                        {isPending && (
                            <LoaderCircle
                                aria-hidden="true"
                                className="animate-spin"
                            />
                        )}
                        Commencer le nouveau diagnostic
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
