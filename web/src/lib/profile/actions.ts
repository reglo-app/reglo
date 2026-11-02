"use server";

import { revalidatePath } from "next/cache";

import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

import { callProfileApi, confirmEmailChange } from "./api";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "./avatar";

export type ProfileField = "firstName" | "lastName" | "jobTitle";
export type PasswordField = "currentPassword" | "newPassword" | "confirmation";
export type EmailField = "email" | "currentPassword";

/** Messages are shown as is: never a technical detail (rule 3). */
export type ProfileState = {
    error?: string;
    fieldErrors?: Partial<Record<ProfileField, string>>;
    saved?: boolean;
};

export type PasswordState = {
    error?: string;
    invalidFields?: PasswordField[];
    saved?: boolean;
};

export type EmailState = {
    error?: string;
    invalidFields?: EmailField[];
    /** The confirmation link was sent (if the address is free). */
    sentTo?: string;
};

export type AvatarState = {
    error?: string;
};

export type EmailConfirmationState = {
    error?: string;
    /** The link expired or was used: a new request is needed. */
    expired?: boolean;
    confirmed?: boolean;
};

const MESSAGES = {
    unavailable:
        "L'opération est impossible pour le moment. Réessayez plus tard.",
    missingFirstName: "Saisissez votre prénom.",
    missingLastName: "Saisissez votre nom.",
    missingCurrentPassword: "Saisissez votre mot de passe actuel.",
    tooShort: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    mismatch: "Les deux mots de passe ne sont pas identiques.",
    missingEmail: "Saisissez la nouvelle adresse e-mail.",
    missingImage: "Choisissez une image.",
    invalidImage: "Choisissez une image JPEG, PNG ou WebP.",
    tooLarge: `L'image ne doit pas dépasser ${AVATAR_MAX_BYTES / 1024 / 1024} Mo.`,
};

function text(formData: FormData, name: string): string {
    return String(formData.get(name) ?? "");
}

/** The shell (name and photo in the menu) shows the change at once. */
function refreshApp() {
    revalidatePath("/", "layout");
}

export async function updateProfile(
    _previous: ProfileState,
    formData: FormData,
): Promise<ProfileState> {
    const firstName = text(formData, "firstName").trim();
    const lastName = text(formData, "lastName").trim();
    const jobTitle = text(formData, "jobTitle").trim();

    const fieldErrors: ProfileState["fieldErrors"] = {};
    if (!firstName) fieldErrors.firstName = MESSAGES.missingFirstName;
    if (!lastName) fieldErrors.lastName = MESSAGES.missingLastName;
    if (Object.keys(fieldErrors).length > 0) {
        return { error: Object.values(fieldErrors)[0], fieldErrors };
    }

    const result = await callProfileApi("PATCH", "/api/me", {
        firstName,
        lastName,
        jobTitle,
    });

    if (result.status === "success") {
        refreshApp();
        return { saved: true };
    }
    if (result.status === "rejected") {
        return { error: result.message, fieldErrors: result.fields };
    }
    return { error: MESSAGES.unavailable };
}

export async function changePassword(
    _previous: PasswordState,
    formData: FormData,
): Promise<PasswordState> {
    const currentPassword = text(formData, "currentPassword");
    const newPassword = text(formData, "newPassword");
    const confirmation = text(formData, "confirmation");

    if (!currentPassword) {
        return {
            error: MESSAGES.missingCurrentPassword,
            invalidFields: ["currentPassword"],
        };
    }
    if ([...newPassword].length < MIN_PASSWORD_LENGTH) {
        return { error: MESSAGES.tooShort, invalidFields: ["newPassword"] };
    }
    if (newPassword !== confirmation) {
        return { error: MESSAGES.mismatch, invalidFields: ["confirmation"] };
    }

    const result = await callProfileApi("POST", "/api/me/password", {
        currentPassword,
        newPassword,
    });

    if (result.status === "success") {
        return { saved: true };
    }
    if (result.status === "rejected") {
        return {
            error: result.message,
            invalidFields:
                result.code === "wrong_password"
                    ? ["currentPassword"]
                    : ["newPassword"],
        };
    }
    return { error: MESSAGES.unavailable };
}

export async function requestEmailChange(
    _previous: EmailState,
    formData: FormData,
): Promise<EmailState> {
    const email = text(formData, "email").trim();
    const currentPassword = text(formData, "currentPassword");

    if (!email) {
        return { error: MESSAGES.missingEmail, invalidFields: ["email"] };
    }
    if (!currentPassword) {
        return {
            error: MESSAGES.missingCurrentPassword,
            invalidFields: ["currentPassword"],
        };
    }

    const result = await callProfileApi("POST", "/api/me/email", {
        email,
        currentPassword,
    });

    if (result.status === "success") {
        return { sentTo: email };
    }
    if (result.status === "rejected") {
        return {
            error: result.message,
            invalidFields:
                result.code === "wrong_password"
                    ? ["currentPassword"]
                    : ["email"],
        };
    }
    return { error: MESSAGES.unavailable };
}

export async function uploadAvatar(
    _previous: AvatarState,
    formData: FormData,
): Promise<AvatarState> {
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
        return { error: MESSAGES.missingImage };
    }
    if (!AVATAR_TYPES.includes(file.type)) {
        return { error: MESSAGES.invalidImage };
    }
    if (file.size > AVATAR_MAX_BYTES) {
        return { error: MESSAGES.tooLarge };
    }

    const body = new FormData();
    body.set("file", file);
    const result = await callProfileApi("POST", "/api/me/avatar", body);

    if (result.status === "success") {
        refreshApp();
        return {};
    }
    return {
        error:
            result.status === "rejected"
                ? result.message
                : MESSAGES.unavailable,
    };
}

export async function removeAvatar(): Promise<AvatarState> {
    const result = await callProfileApi("DELETE", "/api/me/avatar");

    if (result.status === "success") {
        refreshApp();
        return {};
    }
    return { error: MESSAGES.unavailable };
}

/** Link of the e-mail sent to the new address (public page). */
export async function confirmNewEmail(
    _previous: EmailConfirmationState,
    formData: FormData,
): Promise<EmailConfirmationState> {
    const result = await confirmEmailChange(text(formData, "token"));

    if (result.status === "success") {
        return { confirmed: true };
    }
    if (result.status === "rejected") {
        return {
            error: result.message,
            expired: result.code === "invalid_token",
        };
    }
    return { error: MESSAGES.unavailable };
}
