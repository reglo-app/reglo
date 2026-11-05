"use server";

import { revalidatePath } from "next/cache";

import { callApi } from "@/lib/api/call";

/** Messages are shown as is: never a technical detail (rule 3). */
export type DocumentActionResult = { ok: true } | { error: string };

/** Deletes the document and its file: its author or an administrator. */
export async function deleteDocument(
    documentId: string,
): Promise<DocumentActionResult> {
    const result = await callApi(
        "DELETE",
        `/api/documents/${encodeURIComponent(documentId)}`,
    );

    if (result.status === "success") {
        revalidatePath("/documents");
        return { ok: true };
    }
    return {
        error:
            result.status === "rejected"
                ? result.message
                : "La suppression est impossible pour le moment. Réessayez dans un instant.",
    };
}
