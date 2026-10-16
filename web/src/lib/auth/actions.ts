"use server";

import { redirect } from "next/navigation";

import { requestAccessToken } from "./api";
import { safeRedirectPath } from "./redirect";
import { clearSession, setSessionToken } from "./session";

export type LoginState = {
    /** Message shown above the form. Never a technical detail (rule 3). */
    error?: string;
    /** Kept so the user does not have to type it again. */
    email?: string;
};

// The same message whether the e-mail or the password is wrong (US-02).
const MESSAGES = {
    missing: "Saisissez votre adresse e-mail et votre mot de passe.",
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
        return { error: MESSAGES.missing, email };
    }

    const result = await requestAccessToken(email, password);

    if (result.status !== "success") {
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
