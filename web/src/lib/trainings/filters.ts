import type {
    TrainingLessonType,
    TrainingLevel,
    TrainingSummary,
} from "@/lib/api/types";
import { DOMAIN_KEYS, type DomainKey } from "@/lib/domains";

export const TRAINING_ACCESSES = ["free", "paid"] as const;
export type TrainingAccess = (typeof TRAINING_ACCESSES)[number];

export const TRAINING_ACCESS_LABELS: Record<TrainingAccess, string> = {
    free: "Gratuites",
    paid: "Payantes",
};

export const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
    beginner: "Débutant",
    intermediate: "Intermédiaire",
    advanced: "Avancé",
};

export const LESSON_TYPE_LABELS: Record<TrainingLessonType, string> = {
    text: "Lecture",
    video: "Vidéo",
    pdf: "Document PDF",
};

/** Filters of the catalog (US-13), kept in the URL. */
export type TrainingFilters = {
    domain?: DomainKey;
    access?: TrainingAccess;
};

function oneOf<T extends string>(
    values: readonly T[],
    value: string | string[] | undefined,
): T | undefined {
    return values.includes(value as T) ? (value as T) : undefined;
}

/**
 * The filters of a URL. A hand-written value that does not exist is ignored:
 * the whole catalog is better than an error page.
 */
export function parseTrainingFilters(
    params: Record<string, string | string[] | undefined>,
): TrainingFilters {
    const filters: TrainingFilters = {
        domain: oneOf(DOMAIN_KEYS, params.domain),
        access: oneOf(TRAINING_ACCESSES, params.access),
    };
    return Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== undefined),
    );
}

/** "?domain=safety&access=free", or "" without any filter. */
export function trainingFiltersQuery(filters: TrainingFilters): string {
    const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => Boolean(value)),
    ).toString();
    return query === "" ? "" : `?${query}`;
}

/** The same filters as the API, for the mock data only. */
export function filterTrainings(
    trainings: TrainingSummary[],
    filters: TrainingFilters,
): TrainingSummary[] {
    return trainings.filter(
        (training) =>
            (!filters.domain || training.domain === filters.domain) &&
            (!filters.access || training.free === (filters.access === "free")),
    );
}

/** "45 min", "1 h", "1 h 30". */
export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0
        ? `${hours} h`
        : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** "1 leçon terminée sur 3". */
export function progressText(done: number, total: number): string {
    return `${done} ${done > 1 ? "leçons terminées" : "leçon terminée"} sur ${total}`;
}
