"use client";

import { useState, useTransition } from "react";
import { CircleAlert, CircleCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setLessonCompleted } from "@/lib/trainings/actions";

/**
 * Marks the lesson as done, or no longer done (US-13). The page follows
 * (revalidated by the server action).
 */
export function LessonCompleteButton({
    courseId,
    lessonId,
    completed,
    save = setLessonCompleted,
}: {
    courseId: string;
    lessonId: string;
    completed: boolean;
    /** Injected in tests; the server action by default. */
    save?: typeof setLessonCompleted;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function mark(done: boolean) {
        setError(null);
        startTransition(async () => {
            const result = await save(courseId, lessonId, done);
            if ("error" in result) {
                setError(result.error);
            } else {
                const { completedCount, lessonCount } = result.progress;
                toast.success(
                    done
                        ? `Leçon terminée (${completedCount} / ${lessonCount}).`
                        : "La leçon n'est plus marquée comme terminée.",
                );
            }
        });
    }

    return (
        <div className="flex flex-col gap-3">
            {completed ? (
                <div className="flex flex-wrap items-center gap-3">
                    <p className="flex items-center gap-2 font-medium text-green-700">
                        <CircleCheck aria-hidden="true" className="size-5" />
                        Leçon terminée
                    </p>
                    <Button
                        variant="outline"
                        disabled={isPending}
                        onClick={() => mark(false)}
                    >
                        <RotateCcw aria-hidden="true" />
                        Marquer comme non terminée
                    </Button>
                </div>
            ) : (
                <Button
                    className="self-start"
                    disabled={isPending}
                    onClick={() => mark(true)}
                >
                    <CircleCheck aria-hidden="true" />
                    Marquer comme terminée
                </Button>
            )}
            {error && (
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
