"use client";

import { useActionState, useEffect, useState } from "react";
import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { FormField } from "@/components/profile/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import {
    changePassword,
    type PasswordField,
    type PasswordState,
} from "@/lib/profile/actions";

export type PasswordFormProps = {
    /** E-mail of the account, given to password managers. */
    email: string;
    /** Injected in tests; the server action by default. */
    action?: typeof changePassword;
};

/**
 * Change of password. The other sessions are logged out; the fields are
 * emptied after each answer (React resets the form).
 */
export function PasswordForm({
    email,
    action = changePassword,
}: PasswordFormProps) {
    const [state, formAction, isPending] = useActionState<
        PasswordState,
        FormData
    >(action, {});
    const [showPasswords, setShowPasswords] = useState(false);

    useEffect(() => {
        if (state.saved) {
            toast.success(
                "Mot de passe modifié. Vos autres sessions ont été déconnectées.",
            );
        }
    }, [state]);

    function field(name: PasswordField) {
        return {
            invalid: Boolean(state.invalidFields?.includes(name)),
            errorId: "password-error",
            type: showPasswords ? "text" : "password",
            required: true,
        };
    }

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            {state.error && (
                <Alert variant="destructive" id="password-error">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            {/* Lets password managers update the right account. Not sent:
                it has no name. */}
            <input
                type="email"
                autoComplete="username"
                value={email}
                readOnly
                hidden
            />

            <FormField
                id="currentPassword"
                label="Mot de passe actuel"
                autoComplete="current-password"
                {...field("currentPassword")}
            />
            <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                    id="newPassword"
                    label="Nouveau mot de passe"
                    hint={`${MIN_PASSWORD_LENGTH} caractères minimum.`}
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    {...field("newPassword")}
                />
                <FormField
                    id="confirmation"
                    label="Confirmez le nouveau mot de passe"
                    autoComplete="new-password"
                    {...field("confirmation")}
                />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="outline" disabled={isPending}>
                    {isPending && (
                        <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                        />
                    )}
                    {isPending ? "Modification…" : "Modifier le mot de passe"}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={showPasswords}
                    onClick={() => setShowPasswords((shown) => !shown)}
                >
                    {showPasswords ? (
                        <EyeOff aria-hidden="true" />
                    ) : (
                        <Eye aria-hidden="true" />
                    )}
                    Afficher les mots de passe
                </Button>
            </div>
        </form>
    );
}
