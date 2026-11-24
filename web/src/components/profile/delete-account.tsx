"use client";

import { useActionState, useId, useState } from "react";
import { CircleAlert, LoaderCircle, Trash2 } from "lucide-react";

import { FormField } from "@/components/profile/form-field";
import { Checkbox } from "@/components/ui/checkbox";
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
import { deleteAccount, type DeleteAccountState } from "@/lib/profile/actions";

/**
 * "Supprimer mon compte" (US-04): the password, then an explicit
 * confirmation. On success, the session ends and the login page opens.
 */
export function DeleteAccountButton({
    email,
    action = deleteAccount,
}: {
    /** E-mail of the account, given to password managers. */
    email: string;
    /** Injected in tests; the server action by default. */
    action?: typeof deleteAccount;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive-outline" className="w-fit">
                    <Trash2 aria-hidden="true" />
                    Supprimer mon compte
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Supprimer votre compte ?</DialogTitle>
                    <DialogDescription>
                        Votre nom, votre adresse e-mail, votre mot de passe et
                        votre photo sont effacés définitivement, et toutes vos
                        sessions sont fermées. Ce que vous avez fait pour votre
                        organisation est conservé, sans votre nom.
                    </DialogDescription>
                </DialogHeader>
                {/* Mounted at each opening: the fields start empty. */}
                <DeleteAccountForm email={email} action={action} />
            </DialogContent>
        </Dialog>
    );
}

function DeleteAccountForm({
    email,
    action,
}: {
    email: string;
    action: typeof deleteAccount;
}) {
    const [state, formAction, isPending] = useActionState<
        DeleteAccountState,
        FormData
    >(action, {});
    const [confirmed, setConfirmed] = useState(false);
    const confirmId = useId();
    // After each answer, React empties the form, the box included: the
    // confirmation is asked again, and the button follows the box.
    const [answered, setAnswered] = useState(state);
    if (state !== answered) {
        setAnswered(state);
        setConfirmed(false);
    }

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            {state.error && (
                <Alert variant="destructive" id="delete-account-error">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}
            {/* Lets password managers fill the right account. Not sent:
                it has no name. */}
            <input
                type="email"
                autoComplete="username"
                value={email}
                readOnly
                hidden
            />
            <FormField
                id="delete-account-password"
                name="password"
                label="Mot de passe"
                type="password"
                autoComplete="current-password"
                required
                invalid={Boolean(state.wrongPassword)}
                errorId="delete-account-error"
            />
            <div className="flex items-start gap-3">
                <Checkbox
                    id={confirmId}
                    name="confirm"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5"
                />
                <label htmlFor={confirmId} className="text-base">
                    Je comprends que mon compte sera supprimé définitivement.
                </label>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                    >
                        Annuler
                    </Button>
                </DialogClose>
                <Button
                    type="submit"
                    variant="destructive"
                    disabled={!confirmed || isPending}
                >
                    {isPending && (
                        <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                        />
                    )}
                    Supprimer définitivement
                </Button>
            </DialogFooter>
        </form>
    );
}
