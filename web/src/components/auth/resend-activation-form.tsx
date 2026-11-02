"use client";

import { useActionState } from "react";
import { CircleAlert, LoaderCircle, MailCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resendActivationLink, type ResendState } from "@/lib/auth/activation";

export type ResendActivationFormProps = {
    defaultEmail?: string;
    /** Injected in tests; the server action by default. */
    action?: typeof resendActivationLink;
};

/** Asks for a new activation link when the previous one expired. */
export function ResendActivationForm({
    defaultEmail,
    action = resendActivationLink,
}: ResendActivationFormProps) {
    const [state, formAction, isPending] = useActionState<
        ResendState,
        FormData
    >(action, {});

    if (state.sent) {
        // Same message whether the account exists or not.
        return (
            <Alert variant="success">
                <MailCheck aria-hidden="true" />
                <AlertDescription>
                    Si un compte en attente d&apos;activation correspond à cette
                    adresse, un nouveau lien vient de lui être envoyé. Pensez à
                    vérifier vos courriers indésirables.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            {state.error && (
                <Alert variant="destructive" id="resend-error">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col gap-1.5">
                <label htmlFor="resend-email" className="text-base font-medium">
                    Adresse e-mail
                </label>
                <Input
                    id="resend-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="vous@entreprise.fr"
                    defaultValue={defaultEmail}
                    required
                    aria-describedby={state.error ? "resend-error" : undefined}
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
                {isPending ? "Envoi…" : "Recevoir un nouveau lien"}
            </Button>
        </form>
    );
}
