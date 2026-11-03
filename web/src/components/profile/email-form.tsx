"use client";

import { useActionState, useState } from "react";
import { CircleAlert, LoaderCircle, MailCheck } from "lucide-react";

import { FormField } from "@/components/profile/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requestEmailChange, type EmailState } from "@/lib/profile/actions";

export type EmailFormProps = {
    currentEmail: string;
    /** Injected in tests; the server action by default. */
    action?: typeof requestEmailChange;
};

/**
 * New address: it only replaces the current one once the link sent to it
 * is opened.
 */
export function EmailForm({
    currentEmail,
    action = requestEmailChange,
}: EmailFormProps) {
    const [state, formAction, isPending] = useActionState<EmailState, FormData>(
        action,
        {},
    );
    // Controlled: a refused address stays in the field.
    const [email, setEmail] = useState("");

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            <p>
                Adresse actuelle :{" "}
                <span className="font-medium wrap-break-word">
                    {currentEmail}
                </span>
            </p>

            {state.sentTo && (
                <Alert variant="success">
                    <MailCheck aria-hidden="true" />
                    <AlertDescription>
                        Si l&apos;adresse {state.sentTo} n&apos;est pas déjà
                        utilisée, un lien de confirmation vient d&apos;y être
                        envoyé. Votre adresse actuelle reste valable tant que le
                        lien n&apos;est pas ouvert.
                    </AlertDescription>
                </Alert>
            )}

            {state.error && (
                <Alert variant="destructive" id="email-error">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                    id="email"
                    label="Nouvelle adresse e-mail"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="vous@entreprise.fr"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    invalid={Boolean(state.invalidFields?.includes("email"))}
                    errorId="email-error"
                    required
                />
                <FormField
                    id="email-current-password"
                    name="currentPassword"
                    label="Mot de passe actuel"
                    hint="Pour confirmer que c'est bien vous."
                    type="password"
                    autoComplete="current-password"
                    invalid={Boolean(
                        state.invalidFields?.includes("currentPassword"),
                    )}
                    errorId="email-error"
                    required
                />
            </div>

            <div>
                <Button type="submit" variant="outline" disabled={isPending}>
                    {isPending && (
                        <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                        />
                    )}
                    {isPending ? "Envoi…" : "Envoyer le lien de confirmation"}
                </Button>
            </div>
        </form>
    );
}
