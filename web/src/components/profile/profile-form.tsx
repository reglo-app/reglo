"use client";

import { useActionState, useEffect, useState } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { FormField } from "@/components/profile/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/api";
import { updateProfile, type ProfileState } from "@/lib/profile/actions";

export type ProfileFormProps = {
    user: Pick<CurrentUser, "firstName" | "lastName" | "jobTitle">;
    /** Injected in tests; the server action by default. */
    action?: typeof updateProfile;
};

/** Names and job title. */
export function ProfileForm({
    user,
    action = updateProfile,
}: ProfileFormProps) {
    const [state, formAction, isPending] = useActionState<
        ProfileState,
        FormData
    >(action, {});
    // Controlled: a failed save keeps what the user typed.
    const [values, setValues] = useState({
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        jobTitle: user.jobTitle ?? "",
    });

    useEffect(() => {
        if (state.saved) toast.success("Profil enregistré.");
    }, [state]);

    function field(name: keyof typeof values) {
        return {
            id: name,
            value: values[name],
            onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setValues({ ...values, [name]: event.target.value }),
            invalid: Boolean(state.fieldErrors?.[name]),
            errorId: "profile-error",
        };
    }

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            {state.error && (
                <Alert variant="destructive" id="profile-error">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                    label="Prénom"
                    autoComplete="given-name"
                    maxLength={100}
                    required
                    {...field("firstName")}
                />
                <FormField
                    label="Nom"
                    autoComplete="family-name"
                    maxLength={100}
                    required
                    {...field("lastName")}
                />
            </div>
            <FormField
                label="Fonction"
                hint="Facultatif. Par exemple : Responsable QHSE, Dirigeant."
                autoComplete="organization-title"
                maxLength={100}
                {...field("jobTitle")}
            />

            <div>
                <Button type="submit" disabled={isPending}>
                    {isPending && (
                        <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                        />
                    )}
                    {isPending ? "Enregistrement…" : "Enregistrer"}
                </Button>
            </div>
        </form>
    );
}
