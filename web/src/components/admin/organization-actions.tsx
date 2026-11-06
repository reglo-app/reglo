"use client";

import { useActionState, useCallback, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import {
    FormError,
    SubmitRow,
    useDoneMessage,
} from "@/components/admin/admin-form";
import { FormField } from "@/components/profile/form-field";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    deleteOrganization,
    renameOrganization,
    type AdminFormState,
} from "@/lib/admin/actions";

export type OrganizationActionsProps = {
    id: string;
    name: string;
    userCount: number;
    /** Injected in tests; the server actions by default. */
    rename?: typeof renameOrganization;
    remove?: typeof deleteOrganization;
};

/** Renames or deletes an organization, from its page. */
export function OrganizationActions({
    id,
    name,
    userCount,
    rename = renameOrganization,
    remove = deleteOrganization,
}: OrganizationActionsProps) {
    const [renaming, setRenaming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const closeRename = useCallback(() => setRenaming(false), []);

    return (
        <div className="flex flex-wrap gap-2">
            <Dialog open={renaming} onOpenChange={setRenaming}>
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <Pencil aria-hidden="true" />
                        Renommer
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Renommer {name}</DialogTitle>
                        <DialogDescription>
                            Le nouveau nom est visible tout de suite par ses
                            utilisateurs.
                        </DialogDescription>
                    </DialogHeader>
                    <RenameForm
                        id={id}
                        name={name}
                        action={rename}
                        onDone={closeRename}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={deleting} onOpenChange={setDeleting}>
                <DialogTrigger asChild>
                    <Button variant="destructive-outline">
                        <Trash2 aria-hidden="true" />
                        Supprimer
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Supprimer {name} ?</DialogTitle>
                        <DialogDescription>
                            C&apos;est définitif : les {userCount} compte
                            {userCount > 1 ? "s" : ""}, les diagnostics, le plan
                            d&apos;actions et les documents de cette
                            organisation sont effacés.
                        </DialogDescription>
                    </DialogHeader>
                    <DeleteForm id={id} name={name} action={remove} />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function RenameForm({
    id,
    name,
    action,
    onDone,
}: {
    id: string;
    name: string;
    action: typeof renameOrganization;
    onDone: () => void;
}) {
    const [state, formAction, isPending] = useActionState<
        AdminFormState,
        FormData
    >(action, {});
    const [value, setValue] = useState(name);
    useDoneMessage(state, onDone);

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            <FormError id="rename-error" message={state.error} />
            <input type="hidden" name="organizationId" value={id} />
            <FormField
                id="rename-name"
                name="name"
                label="Nom de l'organisation"
                autoComplete="off"
                maxLength={180}
                required
                value={value}
                onChange={(event) => setValue(event.target.value)}
                invalid={Boolean(state.fieldErrors?.name)}
                errorId="rename-error"
            />
            <SubmitRow isPending={isPending} label="Enregistrer" />
        </form>
    );
}

function DeleteForm({
    id,
    name,
    action,
}: {
    id: string;
    name: string;
    action: typeof deleteOrganization;
}) {
    const [state, formAction, isPending] = useActionState<
        AdminFormState,
        FormData
    >(action, {});
    const [value, setValue] = useState("");

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            <FormError id="delete-error" message={state.error} />
            <input type="hidden" name="organizationId" value={id} />
            <FormField
                id="delete-confirm-name"
                name="confirmName"
                label={`Saisissez « ${name} » pour confirmer`}
                autoComplete="off"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                invalid={Boolean(state.error)}
                errorId="delete-error"
            />
            <SubmitRow
                isPending={isPending}
                label="Supprimer définitivement"
                variant="destructive"
                disabled={value.trim() !== name}
            />
        </form>
    );
}
