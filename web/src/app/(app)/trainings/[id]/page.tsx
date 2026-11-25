import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Lock } from "lucide-react";

import { DomainBadge } from "@/components/domain-badge";
import { PageHeader } from "@/components/page-header";
import { LessonPlayer } from "@/components/trainings/lesson-player";
import { TrainingProgress } from "@/components/trainings/training-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { TrainingDetail } from "@/lib/api/types";
import { formatDuration, TRAINING_LEVEL_LABELS } from "@/lib/trainings/filters";

type Props = PageProps<"/trainings/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const training = await api.getTraining(id);
    return { title: training?.title ?? "Formation" };
}

async function TrainingContent({
    params,
    searchParams,
}: Pick<Props, "params" | "searchParams">) {
    const [{ id }, query] = await Promise.all([params, searchParams]);
    const training = await api.getTraining(id);
    if (!training) {
        notFound();
    }
    const lessonId =
        typeof query.lesson === "string" ? query.lesson : undefined;

    return (
        <>
            <PageHeader
                title={training.title}
                description={training.summary}
                action={
                    <Button asChild variant="outline">
                        <Link href="/trainings">
                            <ArrowLeft aria-hidden="true" />
                            Toutes les formations
                        </Link>
                    </Button>
                }
            />
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <TrainingFacts training={training} />
                {training.free && (
                    <div className="w-full sm:max-w-xs">
                        <TrainingProgress
                            done={training.completedCount}
                            total={training.lessonCount}
                            label="Progression de la formation"
                        />
                    </div>
                )}
            </div>
            {training.free ? (
                <LessonPlayer training={training} lessonId={lessonId} />
            ) : (
                <PaidTraining training={training} />
            )}
        </>
    );
}

function TrainingFacts({ training }: { training: TrainingDetail }) {
    return (
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div>
                <dt className="sr-only">Domaine</dt>
                <dd>
                    <DomainBadge domain={training.domain} />
                </dd>
            </div>
            <div className="flex items-center gap-1.5">
                <dt className="sr-only">Durée</dt>
                <Clock aria-hidden="true" className="size-4 text-ink-muted" />
                <dd>{formatDuration(training.durationMinutes)}</dd>
            </div>
            <div className="flex gap-1">
                <dt>Niveau :</dt>
                <dd>{TRAINING_LEVEL_LABELS[training.level]}</dd>
            </div>
        </dl>
    );
}

/** No payment in the MVP: the description and the program only. */
function PaidTraining({ training }: { training: TrainingDetail }) {
    return (
        <Card>
            <CardContent className="flex flex-col gap-4">
                <p className="flex items-center gap-2 text-lg font-semibold">
                    <Lock
                        aria-hidden="true"
                        className="size-5 text-ink-muted"
                    />
                    Disponible prochainement
                </p>
                <p className="text-ink-muted">
                    Cette formation fait partie des modules payants, qui
                    ouvriront prochainement. Voici son programme.
                </p>
                <h2 className="font-semibold">Programme</h2>
                <ol className="list-decimal pl-5">
                    {training.lessons.map((lesson) => (
                        <li key={lesson.id}>
                            {lesson.title} (
                            {formatDuration(lesson.durationMinutes)})
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}

function TrainingSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-10 w-1/2" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Skeleton className="h-64 rounded-lg" />
                <Skeleton className="h-96 rounded-lg lg:col-span-2" />
            </div>
        </div>
    );
}

/** One course of the catalog and its lesson player (US-13). */
export default function TrainingPage({ params, searchParams }: Props) {
    // Reading the URL inside Suspense keeps navigation instant.
    return (
        <Suspense fallback={<TrainingSkeleton />}>
            <TrainingContent params={params} searchParams={searchParams} />
        </Suspense>
    );
}
