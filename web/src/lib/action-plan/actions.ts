"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { callApi } from "@/lib/api/call";
import type { ActionDetail, ActionStatus } from "@/lib/api/types";

export type ActionField =
    "title" | "description" | "domain" | "type" | "assigneeId" | "dueDate";

/** Messages are shown as is: never a technical detail (rule 3). */
export type ActionFormState = {
    error?: string;
    fieldErrors?: Partial<Record<ActionField, string>>;
};

export type ActionChangeResult = { ok: true } | { error: string };

const UNAVAILABLE =
    "L'enregistrement est impossible pour le moment. Réessayez dans un instant.";

const FIELDS: ActionField[] = [
    "title",
    "description",
    "domain",
    "type",
    "assigneeId",
    "dueDate",
];

/**
 * Creates the action (null id) or saves its changes, then opens it. The
 * API checks every field: its messages are shown next to them.
 */
export async function saveAction(
    actionId: string | null,
    _previous: ActionFormState,
    formData: FormData,
): Promise<ActionFormState> {
    const body = Object.fromEntries(
        FIELDS.map((name) => [name, String(formData.get(name) ?? "").trim()]),
    );

    const result =
        actionId === null
            ? await callApi<ActionDetail>("POST", "/api/actions", body)
            : await callApi<ActionDetail>(
                  "PATCH",
                  `/api/actions/${encodeURIComponent(actionId)}`,
                  body,
              );

    if (result.status === "rejected") {
        return { error: result.message, fieldErrors: result.fields };
    }
    if (result.status === "unavailable" || !result.data?.id) {
        return { error: UNAVAILABLE };
    }

    revalidatePath("/", "layout");
    redirect(`/actions/${result.data.id}`);
}

/** Moves the action one step forward or back (kept in its history). */
export async function changeActionStatus(
    actionId: string,
    status: ActionStatus,
): Promise<ActionChangeResult> {
    const result = await callApi(
        "POST",
        `/api/actions/${encodeURIComponent(actionId)}/status`,
        { status },
    );

    if (result.status === "success") {
        revalidatePath("/", "layout");
        return { ok: true };
    }
    return {
        error: result.status === "rejected" ? result.message : UNAVAILABLE,
    };
}

/** Deletes the action, then goes back to the action plan. */
export async function deleteAction(
    actionId: string,
): Promise<ActionChangeResult> {
    const result = await callApi(
        "DELETE",
        `/api/actions/${encodeURIComponent(actionId)}`,
    );

    if (result.status !== "success") {
        return {
            error:
                result.status === "rejected"
                    ? result.message
                    : "La suppression est impossible pour le moment. Réessayez dans un instant.",
        };
    }

    revalidatePath("/", "layout");
    redirect("/actions");
}
