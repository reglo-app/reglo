import Link from "next/link";
import { Clock, Lock } from "lucide-react";

import { DomainBadge } from "@/components/domain-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TrainingSummary } from "@/lib/api/types";
import { formatDuration, TRAINING_LEVEL_LABELS } from "@/lib/trainings/filters";

import { TrainingProgress } from "./training-progress";

/** Cards of the catalog (US-13). The title is the link to the course. */
export function TrainingList({ trainings }: { trainings: TrainingSummary[] }) {
    return (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {trainings.map((training) => (
                <li key={training.id}>
                    <TrainingCard training={training} />
                </li>
            ))}
        </ul>
    );
}

function TrainingCard({ training }: { training: TrainingSummary }) {
    return (
        <Card className="relative h-full transition-shadow focus-within:ring-4 focus-within:ring-brand-green/20 hover:shadow-md">
            <CardContent className="flex h-full flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <DomainBadge domain={training.domain} />
                    {training.free ? (
                        <Badge variant="success">Gratuite</Badge>
                    ) : (
                        <Badge variant="secondary">
                            <Lock aria-hidden="true" className="size-3.5" />
                            Payante
                        </Badge>
                    )}
                </div>
                <h3 className="text-base font-semibold">
                    {/* The whole card opens the course (::after covers it). */}
                    <Link
                        href={`/trainings/${training.id}`}
                        className="after:absolute after:inset-0 focus-visible:outline-none"
                    >
                        {training.title}
                    </Link>
                </h3>
                <p className="text-sm text-ink-muted">{training.summary}</p>
                <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <div className="flex items-center gap-1.5">
                        <dt className="sr-only">Durée</dt>
                        <Clock
                            aria-hidden="true"
                            className="size-4 text-ink-muted"
                        />
                        <dd>{formatDuration(training.durationMinutes)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                        <dt className="sr-only">Niveau</dt>
                        <dd>{TRAINING_LEVEL_LABELS[training.level]}</dd>
                    </div>
                </dl>
                {training.free ? (
                    <TrainingProgress
                        done={training.completedCount}
                        total={training.lessonCount}
                        label={`Progression : ${training.title}`}
                    />
                ) : (
                    <p className="text-sm font-medium text-ink-muted">
                        Disponible prochainement
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
