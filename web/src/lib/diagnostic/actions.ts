"use server";

import { revalidatePath } from "next/cache";

import { callApi } from "@/lib/api/call";
import type { AnswerValue, Diagnostic } from "@/lib/api/types";

/** Messages are shown as is: never a technical detail (rule 3). */
export type DiagnosticActionResult = { ok: true } | { error: string };

const UNAVAILABLE =
    "L'enregistrement est impossible pour le moment. Réessayez dans un instant.";

/**
 * Saves one answer of the shared draft (started at the first answer). A
 * null value with notApplicable false removes the answer.
 */
export async function saveAnswer(
    questionId: string,
    value: AnswerValue | null,
    notApplicable: boolean,
): Promise<DiagnosticActionResult> {
    const result = await callApi("PUT", "/api/diagnostics/current/answers", {
        questionId,
        value,
        notApplicable,
    });

    if (result.status === "success") return { ok: true };
    return {
        error: result.status === "rejected" ? result.message : UNAVAILABLE,
    };
}

/** Validates the draft: refused while a mandatory question is unanswered. */
export async function submitDiagnostic(): Promise<
    { submittedAt: string } | { error: string }
> {
    const result = await callApi<Diagnostic>(
        "POST",
        "/api/diagnostics/current/submit",
    );

    if (result.status === "success" && result.data?.submittedAt) {
        revalidatePath("/", "layout");
        return { submittedAt: result.data.submittedAt };
    }
    return {
        error:
            result.status === "rejected"
                ? result.message
                : "La validation est impossible pour le moment. Réessayez plus tard.",
    };
}
