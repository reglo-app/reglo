"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { api } from "@/lib/api";
import { callApi, type ApiCallResult } from "@/lib/api/call";
import type { DocumentAccess } from "@/lib/api/types";

/** Messages are shown as is: never a technical detail (rule 3). */
export type DocumentActionResult = { ok: true } | { error: string };

const UNAVAILABLE =
    "L'opération est impossible pour le moment. Réessayez dans un instant.";

function outcome(
    result: ApiCallResult<unknown>,
    unavailable = UNAVAILABLE,
): DocumentActionResult {
    if (result.status === "success") return { ok: true };
    return {
        error: result.status === "rejected" ? result.message : unavailable,
    };
}

/** Deletes the document, its file and its links: author or administrator. */
export async function deleteDocument(
    documentId: string,
): Promise<DocumentActionResult> {
    const result = await callApi(
        "DELETE",
        `/api/documents/${encodeURIComponent(documentId)}`,
    );

    if (result.status === "success") {
        revalidatePath("/documents");
        revalidatePath("/actions", "layout");
        revalidatePath("/diagnostic");
    }
    return outcome(
        result,
        "La suppression est impossible pour le moment. Réessayez dans un instant.",
    );
}

/** Links a document of the organization to an action (US-12). */
export async function linkActionDocument(
    actionId: string,
    documentId: string,
): Promise<DocumentActionResult> {
    const result = await callApi(
        "POST",
        `/api/actions/${encodeURIComponent(actionId)}/documents`,
        { documentId },
    );

    if (result.status === "success") {
        revalidatePath(`/actions/${actionId}`);
        revalidatePath("/documents");
    }
    return outcome(result);
}

/** The document stays in the list of the organization. */
export async function unlinkActionDocument(
    actionId: string,
    documentId: string,
): Promise<DocumentActionResult> {
    const result = await callApi(
        "DELETE",
        `/api/actions/${encodeURIComponent(actionId)}/documents/${encodeURIComponent(documentId)}`,
    );

    if (result.status === "success") {
        revalidatePath(`/actions/${actionId}`);
        revalidatePath("/documents");
    }
    return outcome(result);
}

/** Links a document to a question of the diagnostic, for the organization. */
export async function linkQuestionDocument(
    questionId: string,
    documentId: string,
): Promise<DocumentActionResult> {
    const result = await callApi("PUT", "/api/question-documents", {
        questionId,
        documentId,
    });

    if (result.status === "success") {
        revalidatePath("/diagnostic");
        revalidatePath("/documents");
    }
    return outcome(result);
}

/** The document stays in the list of the organization. */
export async function unlinkQuestionDocument(
    questionId: string,
    documentId: string,
): Promise<DocumentActionResult> {
    const result = await callApi("DELETE", "/api/question-documents", {
        questionId,
        documentId,
    });

    if (result.status === "success") {
        revalidatePath("/diagnostic");
        revalidatePath("/documents");
    }
    return outcome(result);
}

/** Who opened a document (US-12): administrators only. */
export async function loadDocumentAccesses(
    documentId: string,
): Promise<{ accesses: DocumentAccess[] } | { error: string }> {
    try {
        return { accesses: await api.getDocumentAccesses(documentId) };
    } catch (error) {
        // An expired session still opens the login page.
        unstable_rethrow(error);
        return {
            error: "L'historique est indisponible pour le moment. Réessayez dans un instant.",
        };
    }
}
