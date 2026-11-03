"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { callApi } from "@/lib/api/call";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

import { submitInvitation } from "./api";

export type InviteField = "email" | "firstName" | "lastName";
export type AcceptField =
    "firstName" | "lastName" | "password" | "confirmation";

/** Messages are shown as is: never a technical detail (rule 3). */
export type InviteState = {
    error?: string;
    fieldErrors?: Partial<Record<InviteField, string>>;
    /** The invitation was created and e-mailed to this address. */
    sentTo?: string;
    /** Created, but the e-mail failed: it can be sent again from the list. */
    notSentTo?: string;
};

export type InvitationActionState = {
    error?: string;
    /** Confirmation for the person, e.g. "Invitation renvoyée à …". */
    done?: string;
};

export type AcceptState = {
    error?: string;
    invalidFields?: AcceptField[];
    /** The link expired or was used meanwhile. */
    linkExpired?: boolean;
};

const MESSAGES = {
    unavailable:
        "L'opération est impossible pour le moment. Réessayez plus tard.",
    missingEmail: "Saisissez l'adresse e-mail de la personne à inviter.",
    missingFirstName: "Saisissez votre prénom.",
    missingLastName: "Saisissez votre nom.",
    tooShort: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    mismatch: "Les deux mots de passe ne sont pas identiques.",
    expired:
        "Cette invitation a expiré ou a déjà été utilisée. Demandez une nouvelle invitation à votre administrateur.",
};

function text(formData: FormData, name: string): string {
    return String(formData.get(name) ?? "").trim();
}

function refreshTeam() {
    revalidatePath("/team");
}

export async function inviteMember(
    _previous: InviteState,
    formData: FormData,
): Promise<InviteState> {
    const email = text(formData, "email");
    const firstName = text(formData, "firstName");
    const lastName = text(formData, "lastName");

    if (!email) {
        return {
            error: MESSAGES.missingEmail,
            fieldErrors: { email: MESSAGES.missingEmail },
        };
    }

    const result = await callApi<{ email?: string; emailSent?: boolean }>(
        "POST",
        "/api/invitations",
        { email, firstName, lastName },
    );

    if (result.status === "success") {
        refreshTeam();
        const sentTo = result.data?.email ?? email;
        return result.data?.emailSent === false
            ? { notSentTo: sentTo }
            : { sentTo };
    }
    if (result.status === "unavailable") {
        return { error: MESSAGES.unavailable };
    }

    // "email_unavailable", "already_invited", "invalid_invitation": the
    // address field, unless the API names other fields.
    const fieldErrors: Partial<Record<InviteField, string>> = result.fields
        ? (Object.fromEntries(
              Object.entries(result.fields).filter(([name]) =>
                  ["email", "firstName", "lastName"].includes(name),
              ),
          ) as Partial<Record<InviteField, string>>)
        : result.code === "too_many_invitations"
          ? {}
          : { email: result.message };

    return { error: result.message, fieldErrors };
}

export async function resendInvitation(
    id: string,
    email: string,
): Promise<InvitationActionState> {
    const result = await callApi<{ emailSent?: boolean }>(
        "POST",
        `/api/invitations/${encodeURIComponent(id)}/resend`,
    );

    if (result.status !== "success") {
        return {
            error:
                result.status === "rejected"
                    ? result.message
                    : MESSAGES.unavailable,
        };
    }

    refreshTeam();
    return result.data?.emailSent === false
        ? { error: MESSAGES.unavailable }
        : { done: `Invitation renvoyée à ${email}.` };
}

export async function cancelInvitation(
    id: string,
    email: string,
): Promise<InvitationActionState> {
    const result = await callApi(
        "DELETE",
        `/api/invitations/${encodeURIComponent(id)}`,
    );

    // Already gone (cancelled by another administrator): same outcome.
    if (
        result.status === "success" ||
        (result.status === "rejected" && result.code === "not_found")
    ) {
        refreshTeam();
        return { done: `Invitation de ${email} annulée.` };
    }

    return {
        error:
            result.status === "rejected"
                ? result.message
                : MESSAGES.unavailable,
    };
}

export async function acceptInvitation(
    _previous: AcceptState,
    formData: FormData,
): Promise<AcceptState> {
    const token = String(formData.get("token") ?? "");
    const firstName = text(formData, "firstName");
    const lastName = text(formData, "lastName");
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    if (!firstName) {
        return {
            error: MESSAGES.missingFirstName,
            invalidFields: ["firstName"],
        };
    }
    if (!lastName) {
        return { error: MESSAGES.missingLastName, invalidFields: ["lastName"] };
    }
    if ([...password].length < MIN_PASSWORD_LENGTH) {
        return { error: MESSAGES.tooShort, invalidFields: ["password"] };
    }
    if (password !== confirmation) {
        return { error: MESSAGES.mismatch, invalidFields: ["confirmation"] };
    }

    const result = await submitInvitation({
        token,
        firstName,
        lastName,
        password,
    });

    if (result.status === "unavailable") {
        return { error: MESSAGES.unavailable };
    }
    if (result.status === "rejected") {
        if (result.code === "invalid_token") {
            return { error: MESSAGES.expired, linkExpired: true };
        }
        const invalidFields = Object.keys(result.fields ?? {}).filter(
            (name): name is AcceptField =>
                ["firstName", "lastName", "password"].includes(name),
        );
        return { error: result.message, invalidFields };
    }

    // The login page shows "account activated" and prefills the e-mail.
    redirect("/login?activated=1");
}
