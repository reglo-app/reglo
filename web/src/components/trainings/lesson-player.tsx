import Link from "next/link";
import {
    ArrowLeft,
    ArrowRight,
    CircleCheck,
    Circle,
    ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TrainingDetail, TrainingLesson } from "@/lib/api/types";
import { formatDuration, LESSON_TYPE_LABELS } from "@/lib/trainings/filters";
import { cn } from "@/lib/utils";

import { LessonCompleteButton } from "./lesson-complete-button";

function lessonHref(courseId: string, lessonId: string): string {
    return `/trainings/${courseId}?lesson=${encodeURIComponent(lessonId)}`;
}

/**
 * Player of a free course (US-13): the list of lessons, the current lesson
 * and previous / next links. Plain links: the keyboard, the back button and
 * shared URLs work as everywhere else.
 */
export function LessonPlayer({
    training,
    lessonId,
}: {
    training: TrainingDetail;
    /** From the URL; the first lesson when unknown. */
    lessonId?: string;
}) {
    const index = Math.max(
        0,
        training.lessons.findIndex((lesson) => lesson.id === lessonId),
    );
    const lesson = training.lessons[index];
    const previous = training.lessons[index - 1];
    const next = training.lessons[index + 1];

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <nav aria-label="Leçons de la formation">
                <Card>
                    <CardContent>
                        <ol className="flex flex-col gap-1">
                            {training.lessons.map((item, position) => (
                                <li key={item.id}>
                                    <Link
                                        href={lessonHref(training.id, item.id)}
                                        aria-current={
                                            item.id === lesson.id
                                                ? "page"
                                                : undefined
                                        }
                                        className={cn(
                                            "flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-teal-50 focus-visible:ring-4 focus-visible:ring-brand-green/20 focus-visible:outline-none",
                                            item.id === lesson.id &&
                                                "bg-teal-50 font-semibold",
                                        )}
                                    >
                                        {item.completed ? (
                                            <CircleCheck
                                                aria-hidden="true"
                                                className="mt-0.5 size-4 shrink-0 text-green-700"
                                            />
                                        ) : (
                                            <Circle
                                                aria-hidden="true"
                                                className="mt-0.5 size-4 shrink-0 text-ink-muted"
                                            />
                                        )}
                                        <span>
                                            {position + 1}. {item.title}
                                            {item.completed && (
                                                <>
                                                    {" "}
                                                    <span className="sr-only">
                                                        (terminée)
                                                    </span>
                                                </>
                                            )}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            </nav>
            <article aria-labelledby="lesson-title">
                <Card>
                    <CardContent className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1">
                            <p className="text-sm text-ink-muted">
                                Leçon {index + 1} sur {training.lessons.length}{" "}
                                · {LESSON_TYPE_LABELS[lesson.type]} ·{" "}
                                {formatDuration(lesson.durationMinutes)}
                            </p>
                            <h2
                                id="lesson-title"
                                className="text-lg font-semibold"
                            >
                                {lesson.title}
                            </h2>
                        </div>
                        <LessonContent lesson={lesson} />
                        <LessonCompleteButton
                            // A new lesson starts without the state of the last one.
                            key={lesson.id}
                            courseId={training.id}
                            lessonId={lesson.id}
                            completed={lesson.completed}
                        />
                    </CardContent>
                </Card>
                <div className="mt-4 flex flex-wrap justify-between gap-3">
                    {previous ? (
                        <Button asChild variant="outline">
                            <Link href={lessonHref(training.id, previous.id)}>
                                <ArrowLeft aria-hidden="true" />
                                Leçon précédente
                            </Link>
                        </Button>
                    ) : (
                        <span />
                    )}
                    {next && (
                        <Button asChild>
                            <Link href={lessonHref(training.id, next.id)}>
                                Leçon suivante
                                <ArrowRight aria-hidden="true" />
                            </Link>
                        </Button>
                    )}
                </div>
            </article>
        </div>
    );
}

function LessonContent({ lesson }: { lesson: TrainingLesson }) {
    return (
        <div className="flex flex-col gap-4">
            {lesson.type === "video" && lesson.videoUrl && (
                <div className="aspect-video overflow-hidden rounded-lg bg-teal-50">
                    <iframe
                        src={lesson.videoUrl}
                        title={`Vidéo : ${lesson.title}`}
                        className="size-full"
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allow="fullscreen; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            )}
            {(lesson.paragraphs ?? []).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
            ))}
            {lesson.type === "pdf" && lesson.pdfUrl && (
                <a
                    href={lesson.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 self-start font-medium text-green-700 underline underline-offset-4"
                >
                    Ouvrir le document PDF{" "}
                    <span className="sr-only">(nouvel onglet)</span>
                    <ExternalLink aria-hidden="true" className="size-4" />
                </a>
            )}
            {(lesson.keyPoints ?? []).length > 0 && (
                <section
                    aria-labelledby="key-points-title"
                    className="rounded-lg bg-teal-50 p-4"
                >
                    <h3 id="key-points-title" className="font-semibold">
                        À retenir
                    </h3>
                    <ul className="mt-2 list-disc pl-5">
                        {lesson.keyPoints?.map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>
                </section>
            )}
            {(lesson.transcript ?? []).length > 0 && (
                <section aria-labelledby="transcript-title">
                    <h3 id="transcript-title" className="font-semibold">
                        Transcription de la vidéo
                    </h3>
                    <div className="mt-2 flex flex-col gap-2 text-ink-muted">
                        {lesson.transcript?.map((paragraph, i) => (
                            <p key={i}>{paragraph}</p>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
