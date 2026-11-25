import { Suspense } from "react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { TrainingFilters } from "@/components/trainings/training-filters";
import { TrainingList } from "@/components/trainings/training-list";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { parseTrainingFilters } from "@/lib/trainings/filters";

export const metadata: Metadata = { title: "Formations" };

type SearchParams = PageProps<"/trainings">["searchParams"];

/** Training catalog (US-13), filtered by domain and free / paid. */
async function TrainingsContent({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const filters = parseTrainingFilters(await searchParams);
    const trainings = await api.getTrainings(filters);

    return (
        <section
            aria-labelledby="trainings-list-title"
            className="flex flex-col gap-4"
        >
            <h2 id="trainings-list-title" className="sr-only">
                Catalogue
            </h2>
            <TrainingFilters filters={filters} count={trainings.length} />
            {trainings.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center text-ink-muted">
                        Aucune formation ne correspond à ces filtres.
                    </CardContent>
                </Card>
            ) : (
                <TrainingList trainings={trainings} />
            )}
        </section>
    );
}

function TrainingsSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-16 w-full max-w-xl" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Skeleton className="h-56 rounded-lg" />
                <Skeleton className="h-56 rounded-lg" />
                <Skeleton className="h-56 rounded-lg" />
            </div>
        </div>
    );
}

export default function TrainingsPage({
    searchParams,
}: PageProps<"/trainings">) {
    return (
        <>
            <PageHeader
                title="Formations"
                description="Montez en compétence en qualité, hygiène-santé, sécurité et environnement, à votre rythme."
            />
            {/* Reading the URL inside Suspense keeps navigation instant. */}
            <Suspense fallback={<TrainingsSkeleton />}>
                <TrainingsContent searchParams={searchParams} />
            </Suspense>
        </>
    );
}
