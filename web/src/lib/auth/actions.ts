"use server";

import { redirect } from "next/navigation";

import { requestAccessToken } from "./api";
import { safeRedirectPath } from "./redirect";
import { clearSession, setSessionToken } from "./session";

export type LoginField = "email" | "password";

export type LoginState = {
    /** Message shown above the form. Never a technical detail (rule 3). */
    error?: string;
    /** Fields shown in error. None when the problem is not the input. */
    invalidFields?: LoginField[];
    /** Kept so the user does not have to type it again. */
    email?: string;
};

// The same message whether the e-mail or the password is wrong (US-02).
const MESSAGES = {
    missing: "Saisissez vos identifiants.",
    invalid: "Identifiants incorrects",
    throttled:
        "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
    unavailable:
        "La connexion est impossible pour le moment. Réessayez plus tard.",
};

export async function login(
    _previous: LoginState,
    formData: FormData,
): Promise<LoginState> {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
        const invalidFields: LoginField[] = [];
        if (!email) invalidFields.push("email");
        if (!password) invalidFields.push("password");
        return { error: MESSAGES.missing, invalidFields, email };
    }

    const result = await requestAccessToken(email, password);

    if (result.status === "invalid") {
        // Both fields: the message never says which one is wrong.
        return {
            error: MESSAGES.invalid,
            invalidFields: ["email", "password"],
            email,
        };
    }

    if (result.status !== "success") {
        // Throttled or API down: nothing to fix in the fields.
        return { error: MESSAGES[result.status], email };
    }

    await setSessionToken(result.token);
    redirect(safeRedirectPath(formData.get("next")));
}

export async function logout(): Promise<void> {
    // The API has no revoke endpoint yet: the token stays valid until it
    // expires (1 h), but the browser no longer has it.
    await clearSession();
    redirect("/login");
}
