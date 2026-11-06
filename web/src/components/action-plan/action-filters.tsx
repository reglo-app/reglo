"use client";

import { useId, useOptimistic, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
    ACTION_ORDER_LABELS,
    ACTION_ORDERS,
    actionFiltersQuery,
    type ActionFilters as Filters,
    DUE_FILTER_LABELS,
    DUE_FILTERS,
    hasActionFilters,
} from "@/lib/action-plan/filters";
import {
    personName,
    STATUS_LABELS,
    TYPE_LABELS,
} from "@/lib/action-plan/labels";
import {
    ACTION_STATUSES,
    ACTION_TYPES,
    type ActionPerson,
} from "@/lib/api/types";
import { DOMAIN_KEYS, DOMAINS } from "@/lib/domains";

type Option = { value: string; label: string };

function options<T extends string>(
    values: readonly T[],
    label: (value: T) => string,
): Option[] {
    return values.map((value) => ({ value, label: label(value) }));
}

/**
 * Filters of the action plan. They are kept in the URL (a filtered list can
 * be reloaded or shared), and the list follows without moving the focus; the
 * number of actions is read by screen readers.
 */
export function ActionFilters({
    filters,
    assignees,
    count,
}: {
    filters: Filters;
    assignees: ActionPerson[];
    count: number;
}) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    // Shows the choice at once, while the list is loading.
    const [current, setCurrent] = useOptimistic(filters);
    const firstFilter = useRef<HTMLSelectElement>(null);

    function apply(next: Filters) {
        startTransition(() => {
            setCurrent(next);
            router.replace(`/actions${actionFiltersQuery(next)}`, {
                scroll: false,
            });
        });
    }

    function change(name: keyof Filters, value: string) {
        apply({ ...current, [name]: value || undefined });
    }

    function reset() {
        apply({ order: current.order });
        // The button disappears: the focus must not be lost with it.
        firstFilter.current?.focus();
    }

    return (
        <div
            role="group"
            aria-label="Filtrer les actions"
            className="flex flex-col gap-3"
        >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <Filter
                    ref={firstFilter}
                    label="Statut"
                    value={current.status}
                    onChange={(value) => change("status", value)}
                    allLabel="Tous"
                    options={options(
                        ACTION_STATUSES,
                        (status) => STATUS_LABELS[status],
                    )}
                />
                <Filter
                    label="Domaine"
                    value={current.domain}
                    onChange={(value) => change("domain", value)}
                    allLabel="Tous"
                    options={options(
                        DOMAIN_KEYS,
                        (domain) => DOMAINS[domain].label,
                    )}
                />
                <Filter
                    label="Type"
                    value={current.type}
                    onChange={(value) => change("type", value)}
                    allLabel="Tous"
                    options={options(ACTION_TYPES, (type) => TYPE_LABELS[type])}
                />
                <Filter
                    label="Responsable"
                    value={current.assignee}
                    onChange={(value) => change("assignee", value)}
                    allLabel="Tous"
                    options={assignees.map((assignee) => ({
                        value: assignee.id,
                        label: personName(assignee),
                    }))}
                />
                <Filter
                    label="Échéance"
                    value={current.due}
                    onChange={(value) => change("due", value)}
                    allLabel="Toutes"
                    options={options(
                        DUE_FILTERS,
                        (due) => DUE_FILTER_LABELS[due],
                    )}
                />
                <Filter
                    label="Tri par échéance"
                    value={current.order ?? "asc"}
                    onChange={(value) =>
                        apply({
                            ...current,
                            order: value === "desc" ? "desc" : undefined,
                        })
                    }
                    options={options(
                        ACTION_ORDERS,
                        (order) => ACTION_ORDER_LABELS[order],
                    )}
                />
            </div>
            <div className="flex min-h-10 flex-wrap items-center gap-3">
                <p role="status" className="text-sm text-ink-muted">
                    {count === 0
                        ? "Aucune action"
                        : `${count} action${count > 1 ? "s" : ""}`}
                </p>
                {hasActionFilters(current) && (
                    <Button
                        type="button"
                        variant="outline"
                        size="toolbar"
                        onClick={reset}
                    >
                        <RotateCcw aria-hidden="true" />
                        Effacer les filtres
                    </Button>
                )}
            </div>
        </div>
    );
}

function Filter({
    ref,
    label,
    value,
    onChange,
    allLabel,
    options: choices,
}: {
    ref?: React.Ref<HTMLSelectElement>;
    label: string;
    value: string | undefined;
    onChange: (value: string) => void;
    /** The choice without filter. */
    allLabel?: string;
    options: Option[];
}) {
    const id = useId();
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium">
                {label}
            </label>
            <NativeSelect
                ref={ref}
                id={id}
                value={value ?? ""}
                onChange={(event) => onChange(event.target.value)}
            >
                {allLabel && <option value="">{allLabel}</option>}
                {choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                        {choice.label}
                    </option>
                ))}
            </NativeSelect>
        </div>
    );
}
