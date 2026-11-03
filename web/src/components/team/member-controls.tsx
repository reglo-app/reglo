"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, UserMinus } from "lucide-react";
import { toast } from "sonner";

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
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { changeMemberRole, removeMember } from "@/lib/team/actions";

/** Same look as Input (the charter has no select component yet). */
export const SELECT_CLASSES =
    "h-10 w-full min-w-0 rounded-md border border-border-strong bg-white px-3 text-base text-ink shadow-xs transition-[color,border-color,box-shadow] duration-200 focus-visible:border-green-600 focus-visible:ring-4 focus-visible:ring-brand-green/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export type MemberRoleSelectProps = {
    memberId: string;
    name: string;
    role: RoleKey;
    /** Injected in tests; the server action by default. */
    change?: typeof changeMemberRole;
};

/**
 * Role of a member, changed as soon as another one is chosen. Back to the
 * previous role when the API refuses (last administrator).
 */
export function MemberRoleSelect({
    memberId,
    name,
    role,
    change = changeMemberRole,
}: MemberRoleSelectProps) {
    const [value, setValue] = useState(role);
    const [isPending, startTransition] = useTransition();
    const id = `role-${memberId}`;

    function choose(next: RoleKey) {
        const previous = value;
        setValue(next);
        startTransition(async () => {
            const result = await change(memberId, next, name);
            if (result.error) {
                setValue(previous);
                toast.error(result.error);
            } else if (result.done) {
                toast.success(result.done);
            }
        });
    }

    return (
        <div className="flex items-center gap-2">
            <label htmlFor={id} className="sr-only">
                Rôle de {name}
            </label>
            <select
                id={id}
                value={value}
                disabled={isPending}
                aria-busy={isPending || undefined}
                onChange={(event) => choose(event.target.value as RoleKey)}
                className={cn(SELECT_CLASSES, "sm:w-44")}
            >
                {ROLE_KEYS.map((key) => (
                    <option key={key} value={key}>
                        {ROLE_LABELS[key]}
                    </option>
                ))}
            </select>
            {isPending && (
                <LoaderCircle
                    aria-hidden="true"
                    className="size-5 shrink-0 animate-spin text-ink-muted"
                />
            )}
        </div>
    );
}

export type RemoveMemberButtonProps = {
    memberId: string;
    name: string;
    /** Injected in tests; the server action by default. */
    remove?: typeof removeMember;
};

/** Asks for a confirmation: the account of the member is deleted. */
export function RemoveMemberButton({
    memberId,
    name,
    remove = removeMember,
}: RemoveMemberButtonProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    function confirm() {
        startTransition(async () => {
            const result = await remove(memberId, name);
            if (result.error) {
                toast.error(result.error);
            } else if (result.done) {
                toast.success(result.done);
                setOpen(false);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    aria-label={`Retirer ${name} de l'équipe`}
                    // Icon only from sm: as wide as the spacer of one's own row
                    className="sm:size-10 sm:px-0"
                >
                    <UserMinus aria-hidden="true" />
                    <span className="sm:sr-only">Retirer</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Retirer {name} de l&apos;équipe ?</DialogTitle>
                    <DialogDescription>
                        Son compte est supprimé : cette personne ne pourra plus
                        se connecter. Vous pourrez l&apos;inviter à nouveau.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Annuler</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={isPending}
                        onClick={confirm}
                    >
                        {isPending && (
                            <LoaderCircle
                                aria-hidden="true"
                                className="animate-spin"
                            />
                        )}
                        Retirer de l&apos;équipe
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
