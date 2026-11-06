import {
    ACTION_STATUSES,
    ACTION_TYPES,
    type ActionStatus,
    type ActionType,
} from "@/lib/api/types";
import { DOMAIN_KEYS, type DomainKey } from "@/lib/domains";

export const DUE_FILTERS = ["overdue", "soon", "upcoming"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
    overdue: "En retard",
    soon: "Échéance proche",
    upcoming: "À venir",
};

export const ACTION_ORDERS = ["asc", "desc"] as const;
export type ActionOrder = (typeof ACTION_ORDERS)[number];

export const ACTION_ORDER_LABELS: Record<ActionOrder, string> = {
    asc: "Plus proche",
    desc: "Plus lointaine",
};

/** Filters of the action plan, kept in the URL (US-10). */
export type ActionFilters = {
    status?: ActionStatus;
    domain?: DomainKey;
    type?: ActionType;
    assignee?: string;
    due?: DueFilter;
    order?: ActionOrder;
};

function oneOf<T extends string>(
    values: readonly T[],
    value: string | string[] | undefined,
): T | undefined {
    return values.includes(value as T) ? (value as T) : undefined;
}

/**
 * The filters of a URL. A hand-written value that does not exist is ignored:
 * the whole list is better than an error page.
 */
export function parseActionFilters(
    params: Record<string, string | string[] | undefined>,
    assigneeIds: readonly string[],
): ActionFilters {
    const filters: ActionFilters = {
        status: oneOf(ACTION_STATUSES, params.status),
        domain: oneOf(DOMAIN_KEYS, params.domain),
        type: oneOf(ACTION_TYPES, params.type),
        assignee: oneOf(assigneeIds, params.assignee),
        due: oneOf(DUE_FILTERS, params.due),
        order: oneOf(ACTION_ORDERS, params.order),
    };
    return Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== undefined),
    );
}

/** "?status=todo&due=overdue", or "" without any filter. */
export function actionFiltersQuery(filters: ActionFilters): string {
    const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => Boolean(value)),
    ).toString();
    return query === "" ? "" : `?${query}`;
}

/** Does it hide actions? The order alone does not. */
export function hasActionFilters(filters: ActionFilters): boolean {
    const { status, domain, type, assignee, due } = filters;
    return Boolean(status || domain || type || assignee || due);
}
