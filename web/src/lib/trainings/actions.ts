"use server";

import { revalidatePath } from "next/cache";

import { callApi } from "@/lib/api/call";
import type { TrainingProgress } from "@/lib/api/types";

/** Messages are shown as is: never a technical detail (rule 3). */
export type TrainingActionResult =
    { ok: true; progress: TrainingProgress } | { error: string };

const UNAVAILABLE =
    "L'enregistrement est impossible pour le moment. Réessayez dans un instant.";

/**
 * Marks a lesson as done, or no longer done. Personal progress: every role,
 * readers included.
 */
export async function setLessonCompleted(
    courseId: string,
    lessonId: string,
    completed: boolean,
): Promise<TrainingActionResult> {
    const result = await callApi<TrainingProgress>(
        completed ? "PUT" : "DELETE",
        `/api/me/trainings/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
    );

    if (result.status === "success") {
        revalidatePath("/trainings", "layout");
        return { ok: true, progress: result.data };
    }
    return {
        error: result.status === "rejected" ? result.message : UNAVAILABLE,
    };
}
