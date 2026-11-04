import {
    ACTION_STATUSES,
    type Action,
    type ActionPerson,
    type ActionStatus,
    type ActionType,
    type CurrentUser,
} from "@/lib/api/types";

export const STATUS_LABELS: Record<ActionStatus, string> = {
    todo: "À faire",
    in_progress: "En cours",
    in_review: "En revue",
    done: "Terminée",
};

export const TYPE_LABELS: Record<ActionType, string> = {
    corrective: "Corrective",
    preventive: "Préventive",
    improvement: "Amélioration",
};

export const TYPE_DESCRIPTIONS: Record<ActionType, string> = {
    corrective: "Corrige un problème constaté.",
    preventive: "Évite qu'un risque ne se produise.",
    improvement: "Va au-delà de ce qui est exigé.",
};

/** "Camille Martin", or the e-mail when no name is known. */
export function personName(person: ActionPerson): string {
    const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
    return name || person.email;
}

/** The steps an action can move to: the previous one, then the next one. */
export function statusMoves(status: ActionStatus): {
    previous: ActionStatus | null;
    next: ActionStatus | null;
} {
    const index = ACTION_STATUSES.indexOf(status);
    return {
        previous: ACTION_STATUSES[index - 1] ?? null,
        next: ACTION_STATUSES[index + 1] ?? null,
    };
}

/** Same rule as the API: the assignee or an administrator. */
export function canChangeStatus(action: Action, user: CurrentUser): boolean {
    return user.role === "admin" || action.assignee?.id === user.id;
}

/** "YYYY-MM-DD" of today in France (the due dates of the API). */
export function todayInFrance(now: Date = new Date()): string {
    // The Canadian French format is the ISO one.
    return new Intl.DateTimeFormat("fr-CA", {
        timeZone: "Europe/Paris",
    }).format(now);
}
