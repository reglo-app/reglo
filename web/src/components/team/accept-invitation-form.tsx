"use client";

import { useActionState, useState } from "react";
import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";

import { FormField } from "@/components/profile/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { storeActivatedEmail } from "@/lib/auth/activated-email";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import {
    acceptInvitation,
    type AcceptField,
    type AcceptState,
} from "@/lib/team/actions";
import type { InvitationDetails } from "@/lib/team/api";

export type AcceptInvitationFormProps = {
    token: string;
    invitation: Pick<InvitationDetails, "email" | "firstName" | "lastName">;
    /** Injected in tests; the server action by default. */
    action?: typeof acceptInvitation;
};

/**
 * The invited person confirms their name and chooses a password. Then the
 * login page opens, with the e-mail already filled in.
 */
export function AcceptInvitationForm({
    token,
    invitation,
    action = acceptInvitation,
}: AcceptInvitationFormProps) {
    const [state, formAction, isPending] = useActionState<
        AcceptState,
        FormData
    >(action, {});
    const [showPasswords, setShowPasswords] = useState(false);
    // Controlled: a refused form keeps the names typed.
    const [names, setNames] = useState({
        firstName: invitation.firstName ?? "",
        lastName: invitation.lastName ?? "",
    });

    if (state.linkExpired) {
        return (
            <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{state.error}</AlertDescription>
            </Alert>
        );
    }

    function invalid(field: AcceptField) {
        return Boolean(state.invalidFields?.includes(field));
    }

    function nameField(name: "firstName" | "lastName") {
        return {
            id: name,
            value: names[name],
            onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setNames({ ...names, [name]: event.target.value }),
            invalid: invalid(name),
            errorId: "invitation-error",
            maxLength: 100,
            required: true,
        };
    }

    return (
        <form
            action={formAction}
            // The login page opened next prefills this e-mail.
            onSubmit={() => storeActivatedEmail(invitation.email)}
            className="flex flex-col gap-5"
            noValidate
        >
            {state.error && (
                <Alert variant="destructive" id="invitation-error">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            <input type="hidden" name="token" value={token} />
            {/* Lets password managers save the password with the right
                account. Not sent: it has no name. */}
            <input
                type="email"
                autoComplete="username"
                value={invitation.email}
                readOnly
                hidden
            />

            <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                    label="Prénom"
                    autoComplete="given-name"
                    {...nameField("firstName")}
                />
                <FormField
                    label="Nom"
                    autoComplete="family-name"
                    {...nameField("lastName")}
                />
            </div>
            <FormField
                id="password"
                label="Mot de passe"
                hint={`${MIN_PASSWORD_LENGTH} caractères minimum.`}
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                invalid={invalid("password")}
                errorId="invitation-error"
            />
            <FormField
                id="confirmation"
                label="Confirmez le mot de passe"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                required
                invalid={invalid("confirmation")}
                errorId="invitation-error"
            />
            <Button
                type="button"
                variant="ghost"
                className="self-start"
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

            <Button
                type="submit"
                size="lg"
                disabled={isPending}
                className="text-base"
            >
                {isPending && (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                )}
                {isPending ? "Création du compte…" : "Rejoindre l'équipe"}
            </Button>
        </form>
    );
}
