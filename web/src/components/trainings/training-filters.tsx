"use client";

import { useId, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";

import { NativeSelect } from "@/components/ui/native-select";
import { DOMAIN_KEYS, DOMAINS } from "@/lib/domains";
import {
    TRAINING_ACCESS_LABELS,
    TRAINING_ACCESSES,
    trainingFiltersQuery,
    type TrainingFilters as Filters,
} from "@/lib/trainings/filters";

/**
 * Domain and free / paid filters of the catalog (US-13), kept in the URL
 * like the other lists. The number of courses is read by screen readers.
 */
export function TrainingFilters({
    filters,
    count,
}: {
    filters: Filters;
    count: number;
}) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    // Shows the choice at once, while the list is loading.
    const [current, setCurrent] = useOptimistic(filters);
    const domainId = useId();
    const accessId = useId();

    function change(name: keyof Filters, value: string) {
        const next = { ...current, [name]: value || undefined };
        startTransition(() => {
            setCurrent(next);
            router.replace(`/trainings${trainingFiltersQuery(next)}`, {
                scroll: false,
            });
        });
    }

    return (
        <div
            role="group"
            aria-label="Filtrer les formations"
            className="flex flex-col gap-3"
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <label htmlFor={domainId} className="text-sm font-medium">
                        Domaine
                    </label>
                    <NativeSelect
                        id={domainId}
                        value={current.domain ?? ""}
                        onChange={(event) =>
                            change("domain", event.target.value)
                        }
                    >
                        <option value="">Tous</option>
                        {DOMAIN_KEYS.map((domain) => (
                            <option key={domain} value={domain}>
                                {DOMAINS[domain].label}
                            </option>
                        ))}
                    </NativeSelect>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <label htmlFor={accessId} className="text-sm font-medium">
                        Accès
                    </label>
                    <NativeSelect
                        id={accessId}
                        value={current.access ?? ""}
                        onChange={(event) =>
                            change("access", event.target.value)
                        }
                    >
                        <option value="">Toutes</option>
                        {TRAINING_ACCESSES.map((access) => (
                            <option key={access} value={access}>
                                {TRAINING_ACCESS_LABELS[access]}
                            </option>
                        ))}
                    </NativeSelect>
                </div>
            </div>
            <p role="status" className="text-sm text-ink-muted">
                {count === 0
                    ? "Aucune formation"
                    : `${count} formation${count > 1 ? "s" : ""}`}
            </p>
        </div>
    );
}
