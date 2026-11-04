"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, Trash2 } from "lucide-react";
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
import { changeActionStatus, deleteAction } from "@/lib/action-plan/actions";
import { STATUS_LABELS, statusMoves } from "@/lib/action-plan/labels";
import type { ActionStatus } from "@/lib/api/types";

/**
 * Moves the action to the next step, or back to the previous one. Shown
 * to the assignee and the administrators only (checked again by the API).
 */
export function StatusControl({
    actionId,
    status,
    change = changeActionStatus,
}: {
    actionId: string;
    status: ActionStatus;
    /** Injected in tests; the server action by default. */
    change?: typeof changeActionStatus;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const { previous, next } = statusMoves(status);

    function move(to: ActionStatus) {
        setError(null);
        startTransition(async () => {
            const result = await change(actionId, to);
            if ("error" in result) {
                setError(result.error);
            } else {
                toast.success(`Action passée à « ${STATUS_LABELS[to]} ».`);
            }
        });
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
                {next && (
                    <Button disabled={isPending} onClick={() => move(next)}>
                        Passer à « {STATUS_LABELS[next]} »
                        <ArrowRight aria-hidden="true" />
                    </Button>
                )}
                {previous && (
                    <Button
                        variant="outline"
                        disabled={isPending}
                        onClick={() => move(previous)}
                    >
                        <ArrowLeft aria-hidden="true" />
                        Revenir à « {STATUS_LABELS[previous]} »
                    </Button>
                )}
            </div>
            {error && (
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}

/** "Supprimer", confirmed in a dialog. */
export function DeleteActionButton({
    actionId,
    title,
    remove = deleteAction,
}: {
    actionId: string;
    title: string;
    /** Injected in tests; the server action by default. */
    remove?: typeof deleteAction;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function confirm() {
        setError(null);
        startTransition(async () => {
            // On success, the server action opens the action plan.
            const result = await remove(actionId);
            if ("error" in result) setError(result.error);
        });
    }

    return (
        <Dialog onOpenChange={() => setError(null)}>
            <DialogTrigger asChild>
                <Button variant="destructive-outline">
                    <Trash2 aria-hidden="true" />
                    Supprimer
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Supprimer cette action ?</DialogTitle>
                    <DialogDescription>
                        « {title} » et son historique seront supprimés
                        définitivement.
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
                        {isPending ? "Suppression…" : "Supprimer l'action"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
