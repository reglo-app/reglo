"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { CircleAlert, LoaderCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { FormField } from "@/components/profile/form-field";
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
import {
    inviteMember,
    type InviteField,
    type InviteState,
} from "@/lib/team/actions";

export type InviteDialogProps = {
    organizationName: string;
    /** Injected in tests; the server action by default. */
    action?: typeof inviteMember;
};

/** "Inviter un collaborateur": the primary action of the "Équipe" page. */
export function InviteDialog({
    organizationName,
    action = inviteMember,
}: InviteDialogProps) {
    const [open, setOpen] = useState(false);
    // Stable: the form stays mounted while the dialog closes, and must not
    // see a new callback (and show its message again) meanwhile.
    const close = useCallback(() => setOpen(false), []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <UserPlus aria-hidden="true" />
                    Inviter un collaborateur
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Inviter un collaborateur</DialogTitle>
                    <DialogDescription>
                        La personne reçoit un e-mail pour rejoindre{" "}
                        {organizationName} avec le rôle Membre. Le lien est
                        valable 7 jours.
                    </DialogDescription>
                </DialogHeader>
                {/* Mounted at each opening: the form starts empty. */}
                <InviteForm action={action} onDone={close} />
            </DialogContent>
        </Dialog>
    );
}

function InviteForm({
    action,
    onDone,
}: {
    action: typeof inviteMember;
    onDone: () => void;
}) {
    const [state, formAction, isPending] = useActionState<
        InviteState,
        FormData
    >(action, {});
    // Controlled: a refused address stays in the field.
    const [values, setValues] = useState({
        email: "",
        firstName: "",
        lastName: "",
    });

    useEffect(() => {
        if (state.sentTo) {
            toast.success(`Invitation envoyée à ${state.sentTo}.`);
            onDone();
        } else if (state.notSentTo) {
            toast.warning(
                `L'invitation de ${state.notSentTo} est créée, mais l'e-mail n'a pas pu être envoyé. Renvoyez-la depuis la liste.`,
            );
            onDone();
        }
    }, [state, onDone]);

    function field(name: InviteField) {
        return {
            id: `invite-${name}`,
            name,
            value: values[name],
            onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setValues({ ...values, [name]: event.target.value }),
            invalid: Boolean(state.fieldErrors?.[name]),
            errorId: "invite-error",
        };
    }

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            {state.error && (
                <Alert variant="destructive" id="invite-error">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            <FormField
                label="Adresse e-mail"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="prenom.nom@entreprise.fr"
                maxLength={180}
                required
                {...field("email")}
            />
            <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                    label="Prénom"
                    hint="Facultatif."
                    autoComplete="off"
                    maxLength={100}
                    {...field("firstName")}
                />
                <FormField
                    label="Nom"
                    hint="Facultatif."
                    autoComplete="off"
                    maxLength={100}
                    {...field("lastName")}
                />
            </div>

            <div className="flex justify-end">
                <Button type="submit" disabled={isPending}>
                    {isPending && (
                        <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                        />
                    )}
                    {isPending ? "Envoi…" : "Envoyer l'invitation"}
                </Button>
            </div>
        </form>
    );
}
