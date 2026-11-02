"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    confirmNewEmail,
    type EmailConfirmationState,
} from "@/lib/profile/actions";

export type EmailConfirmationFormProps = {
    token: string;
    newEmail: string;
    /** Injected in tests; the server action by default. */
    action?: typeof confirmNewEmail;
};

/**
 * One click to confirm: opening the link alone changes nothing, so a mail
 * scanner that follows links cannot confirm for the user.
 */
export function EmailConfirmationForm({
    token,
    newEmail,
    action = confirmNewEmail,
}: EmailConfirmationFormProps) {
    const [state, formAction, isPending] = useActionState<
        EmailConfirmationState,
        FormData
    >(action, {});

    if (state.confirmed) {
        return (
            <div className="flex flex-col gap-5">
                <Alert variant="success">
                    <CircleCheck aria-hidden="true" />
                    <AlertDescription>
                        Votre adresse e-mail est maintenant {newEmail}. Vos
                        sessions ont été fermées : connectez-vous avec cette
                        adresse.
                    </AlertDescription>
                </Alert>
                <Button asChild size="lg" className="text-base">
                    <Link href="/login">Se connecter</Link>
                </Button>
            </div>
        );
    }

    return (
        <form action={formAction} className="flex flex-col gap-5">
            {state.error && (
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>
                        {state.error}
                        {state.expired &&
                            " Refaites la demande depuis votre profil."}
                    </AlertDescription>
                </Alert>
            )}

            <input type="hidden" name="token" value={token} />
            <Button
                type="submit"
                size="lg"
                disabled={isPending || state.expired}
                className="text-base"
            >
                {isPending && (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                )}
                {isPending ? "Confirmation…" : "Confirmer ma nouvelle adresse"}
            </Button>
        </form>
    );
}
