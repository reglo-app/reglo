"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

/** Same words as the API when the score cannot be computed (503). */
const SCORE_UNAVAILABLE =
    "Le calcul du score est temporairement indisponible. Vos réponses sont conservées : réessayez dans un instant.";

/**
 * Validates the draft and computes its score: refused while a mandatory
 * question is unanswered. When it fails, the draft stays as it was.
 */
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
            result.status === "rejected" ? result.message : SCORE_UNAVAILABLE,
    };
}

/**
 * "Refaire un diagnostic" (US-07): a new draft with the answers of this
 * diagnostic, which stays in the history. Opens the questions.
 */
export async function restartDiagnostic(
    diagnosticId: string,
): Promise<DiagnosticActionResult> {
    const result = await callApi(
        "POST",
        `/api/diagnostics/${encodeURIComponent(diagnosticId)}/restart`,
    );

    if (result.status !== "success") {
        return {
            error:
                result.status === "rejected"
                    ? result.message
                    : "Le nouveau diagnostic n'a pas pu être créé. Réessayez dans un instant.",
        };
    }
    revalidatePath("/", "layout");
    // Every answer is there: the review starts at the first question.
    redirect("/diagnostic?reprise=1");
}
