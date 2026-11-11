"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROLE_LABELS, type RoleKey } from "@/lib/api";
import { callApi, type ApiCallResult } from "@/lib/api/call";

export type AdminField =
    "name" | "email" | "firstName" | "lastName" | "role" | "confirmName";

/** Messages are shown as is: never a technical detail (rule 3). */
export type AdminFormState = {
    error?: string;
    fieldErrors?: Partial<Record<AdminField, string>>;
    /** Done: shown to the person, then the dialog closes. */
    done?: string;
    /** Done, but the activation e-mail failed: it can be sent again. */
    warning?: string;
};

export type AdminActionState = {
    error?: string;
    done?: string;
};

const UNAVAILABLE =
    "L'opération est impossible pour le moment. Réessayez plus tard.";

function text(formData: FormData, name: string): string {
    return String(formData.get(name) ?? "").trim();
}

function refresh() {
    revalidatePath("/admin", "layout");
}

function rejection(result: ApiCallResult<unknown>): AdminFormState {
    if (result.status !== "rejected") return { error: UNAVAILABLE };

    return {
        error: result.message,
        fieldErrors: result.fields as AdminFormState["fieldErrors"],
    };
}

function failure(result: ApiCallResult<unknown>): AdminActionState {
    return {
        error: result.status === "rejected" ? result.message : UNAVAILABLE,
    };
}

/** What to tell after creating an account, depending on the e-mail. */
function afterCreation(
    email: string,
    done: string,
    emailSent: boolean | undefined,
): AdminFormState {
    return emailSent === false
        ? {
              warning: `Le compte de ${email} est créé, mais l'e-mail n'a pas pu être envoyé. Renvoyez le lien depuis la liste.`,
          }
        : { done };
}

/** A client and its first administrator, who receives an activation e-mail. */
export async function createOrganization(
    _previous: AdminFormState,
    formData: FormData,
): Promise<AdminFormState> {
    const email = text(formData, "email");
    const name = text(formData, "name");
    const result = await callApi<{ adminEmail?: string; emailSent?: boolean }>(
        "POST",
        "/api/admin/organizations",
        {
            name,
            adminEmail: email,
            adminFirstName: text(formData, "firstName"),
            adminLastName: text(formData, "lastName"),
        },
    );

    if (result.status !== "success") return rejection(result);

    refresh();
    const adminEmail = result.data?.adminEmail ?? email;
    return afterCreation(
        adminEmail,
        `${name} est créée. Un e-mail d'activation est envoyé à ${adminEmail}.`,
        result.data?.emailSent,
    );
}

export async function renameOrganization(
    _previous: AdminFormState,
    formData: FormData,
): Promise<AdminFormState> {
    const id = text(formData, "organizationId");
    const result = await callApi<{ name?: string }>(
        "PATCH",
        `/api/admin/organizations/${encodeURIComponent(id)}`,
        { name: text(formData, "name") },
    );

    if (result.status !== "success") return rejection(result);

    refresh();
    return {
        done: `L'organisation s'appelle maintenant ${result.data?.name}.`,
    };
}

/** Irreversible. The API checks the name again, whatever is sent here. */
export async function deleteOrganization(
    _previous: AdminFormState,
    formData: FormData,
): Promise<AdminFormState> {
    const id = text(formData, "organizationId");
    const result = await callApi(
        "DELETE",
        `/api/admin/organizations/${encodeURIComponent(id)}`,
        { confirmName: text(formData, "confirmName") },
    );

    if (result.status !== "success") return rejection(result);

    refresh();
    redirect("/admin");
}

/** An account in an organization, with the chosen role. */
export async function addUser(
    _previous: AdminFormState,
    formData: FormData,
): Promise<AdminFormState> {
    const id = text(formData, "organizationId");
    const email = text(formData, "email");
    const result = await callApi<{ email?: string; emailSent?: boolean }>(
        "POST",
        `/api/admin/organizations/${encodeURIComponent(id)}/users`,
        {
            email,
            firstName: text(formData, "firstName"),
            lastName: text(formData, "lastName"),
            role: text(formData, "role"),
        },
    );

    if (result.status !== "success") return rejection(result);

    refresh();
    const sentTo = result.data?.email ?? email;
    return afterCreation(
        sentTo,
        `Le compte est créé. Un e-mail d'activation est envoyé à ${sentTo}.`,
        result.data?.emailSent,
    );
}

/** A new member of the REGLO team. */
export async function inviteTeamMember(
    _previous: AdminFormState,
    formData: FormData,
): Promise<AdminFormState> {
    const email = text(formData, "email");
    const result = await callApi<{ email?: string; emailSent?: boolean }>(
        "POST",
        "/api/admin/team",
        {
            email,
            firstName: text(formData, "firstName"),
            lastName: text(formData, "lastName"),
        },
    );

    if (result.status !== "success") return rejection(result);

    refresh();
    const sentTo = result.data?.email ?? email;
    return afterCreation(
        sentTo,
        `Un e-mail d'activation est envoyé à ${sentTo}.`,
        result.data?.emailSent,
    );
}

export async function changeUserRole(
    id: string,
    role: RoleKey,
    name: string,
): Promise<AdminActionState> {
    const result = await callApi(
        "PATCH",
        `/api/admin/users/${encodeURIComponent(id)}`,
        { role },
    );

    if (result.status !== "success") return failure(result);

    refresh();
    return {
        done: `${name} est maintenant ${ROLE_LABELS[role].toLowerCase()}.`,
    };
}

/** First and last name of any account: a client or a member of the team. */
export async function renameUser(
    _previous: AdminFormState,
    formData: FormData,
): Promise<AdminFormState> {
    const id = text(formData, "userId");
    const result = await callApi<{ firstName?: string; lastName?: string }>(
        "PUT",
        `/api/admin/users/${encodeURIComponent(id)}/name`,
        {
            firstName: text(formData, "firstName"),
            lastName: text(formData, "lastName"),
        },
    );

    if (result.status !== "success") return rejection(result);

    refresh();
    return {
        done: `Le nom est enregistré : ${result.data?.firstName} ${result.data?.lastName}.`,
    };
}

/** Deletes a client account, or the account of a member of the team. */
export async function removeAccount(
    id: string,
    name: string,
    team: boolean,
): Promise<AdminActionState> {
    const path = team ? "/api/admin/team" : "/api/admin/users";
    const result = await callApi("DELETE", `${path}/${encodeURIComponent(id)}`);

    // Already removed by a colleague: same outcome.
    if (
        result.status === "success" ||
        (result.status === "rejected" && result.code === "not_found")
    ) {
        refresh();
        return { done: `Le compte de ${name} est supprimé.` };
    }

    return failure(result);
}

export async function resendActivation(
    id: string,
    email: string,
): Promise<AdminActionState> {
    const result = await callApi<{ emailSent?: boolean }>(
        "POST",
        `/api/admin/users/${encodeURIComponent(id)}/resend-activation`,
    );

    if (result.status !== "success") return failure(result);

    return result.data?.emailSent === false
        ? { error: UNAVAILABLE }
        : { done: `Un nouveau lien d'activation est envoyé à ${email}.` };
}
