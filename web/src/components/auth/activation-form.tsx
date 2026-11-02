"use client";

import { useActionState, useState } from "react";
import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";

import { ResendActivationForm } from "@/components/auth/resend-activation-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    activateAccount,
    type ActivationField,
    type ActivationState,
} from "@/lib/auth/activation";
import { storeActivatedEmail } from "@/lib/auth/activated-email";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export type ActivationFormProps = {
    token: string;
    /** E-mail of the account, given to password managers. */
    email: string;
    /** Injected in tests; the server action by default. */
    action?: typeof activateAccount;
};

export function ActivationForm({
    token,
    email,
    action = activateAccount,
}: ActivationFormProps) {
    const [state, formAction, isPending] = useActionState<
        ActivationState,
        FormData
    >(action, {});
    const [showPassword, setShowPassword] = useState(false);
    // Fields typed in since the last answer lose their red border.
    const [edits, setEdits] = useState<{
        state: ActivationState;
        fields: ActivationField[];
    }>({ state, fields: [] });
    const editedFields = edits.state === state ? edits.fields : [];

    if (state.linkExpired) {
        return (
            <div className="flex flex-col gap-5">
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
                <ResendActivationForm defaultEmail={email} />
            </div>
        );
    }

    function fieldProps(field: ActivationField) {
        const invalid =
            Boolean(state.invalidFields?.includes(field)) &&
            !editedFields.includes(field);
        const describedBy = [
            field === "password" ? "password-hint" : null,
            invalid ? "activation-error" : null,
        ].filter(Boolean);
        return {
            "aria-invalid": invalid || undefined,
            "aria-describedby": describedBy.join(" ") || undefined,
            onChange: () => {
                if (!editedFields.includes(field)) {
                    setEdits({ state, fields: [...editedFields, field] });
                }
            },
        };
    }

    return (
        <form
            action={formAction}
            // The login page opened next prefills this e-mail.
            onSubmit={() => storeActivatedEmail(email)}
            className="flex flex-col gap-5"
            noValidate
        >
            {state.error && (
                <Alert variant="destructive" id="activation-error">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            <input type="hidden" name="token" value={token} />
            {/* Lets password managers save the new password with the right
                account. Not sent: it has no name. */}
            <input
                type="email"
                autoComplete="username"
                value={email}
                readOnly
                hidden
            />

            <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-base font-medium">
                    Mot de passe
                </label>
                <div className="relative">
                    <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={MIN_PASSWORD_LENGTH}
                        required
                        className="pr-11"
                        {...fieldProps("password")}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((shown) => !shown)}
                        aria-label="Afficher les mots de passe"
                        aria-pressed={showPassword}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-ink-muted transition-colors hover:text-ink"
                    >
                        {showPassword ? (
                            <EyeOff aria-hidden="true" className="size-5" />
                        ) : (
                            <Eye aria-hidden="true" className="size-5" />
                        )}
                    </button>
                </div>
                <p id="password-hint" className="text-sm text-ink-muted">
                    {MIN_PASSWORD_LENGTH} caractères minimum.
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmation" className="text-base font-medium">
                    Confirmez le mot de passe
                </label>
                <Input
                    id="confirmation"
                    name="confirmation"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    {...fieldProps("confirmation")}
                />
            </div>

            <Button
                type="submit"
                size="lg"
                disabled={isPending}
                className="text-base transition duration-200"
            >
                {isPending && (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                )}
                {isPending ? "Activation…" : "Activer mon compte"}
            </Button>
        </form>
    );
}
