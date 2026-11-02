"use server";

import { redirect } from "next/navigation";

import { requestActivationLink, submitActivation } from "./api";
import { MIN_PASSWORD_LENGTH } from "./password";

export type ActivationField = "password" | "confirmation";

export type ActivationState = {
    /** Message shown above the form. Never a technical detail (rule 3). */
    error?: string;
    /** Fields shown in error. None when the problem is not the input. */
    invalidFields?: ActivationField[];
    /** The link expired or was used meanwhile: offer a new one. */
    linkExpired?: boolean;
};

export type ResendState = {
    sent?: boolean;
    error?: string;
};

const MESSAGES = {
    tooShort: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    mismatch: "Les deux mots de passe ne sont pas identiques.",
    expired: "Ce lien d'activation a expiré ou a déjà été utilisé.",
    missingEmail: "Saisissez votre adresse e-mail.",
    unavailable:
        "L'opération est impossible pour le moment. Réessayez plus tard.",
};

export async function activateAccount(
    _previous: ActivationState,
    formData: FormData,
): Promise<ActivationState> {
    const token = String(formData.get("token") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    if ([...password].length < MIN_PASSWORD_LENGTH) {
        return { error: MESSAGES.tooShort, invalidFields: ["password"] };
    }
    if (password !== confirmation) {
        return { error: MESSAGES.mismatch, invalidFields: ["confirmation"] };
    }

    const result = await submitActivation(token, password);

    if (result.status === "invalid") {
        return { error: MESSAGES.expired, linkExpired: true };
    }
    if (result.status === "weak_password") {
        return { error: MESSAGES.tooShort, invalidFields: ["password"] };
    }
    if (result.status !== "success") {
        return { error: MESSAGES.unavailable };
    }

    redirect("/login?activated=1");
}

export async function resendActivationLink(
    _previous: ResendState,
    formData: FormData,
): Promise<ResendState> {
    const email = String(formData.get("email") ?? "").trim();

    if (!email) {
        return { error: MESSAGES.missingEmail };
    }

    return (await requestActivationLink(email))
        ? { sent: true }
        : { error: MESSAGES.unavailable };
}
