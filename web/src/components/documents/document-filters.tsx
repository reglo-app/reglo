"use client";

import {
    useEffect,
    useEffectEvent,
    useId,
    useOptimistic,
    useRef,
    useState,
    useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { personName } from "@/lib/action-plan/labels";
import type { ActionPerson } from "@/lib/api/types";
import {
    DOCUMENT_FORMAT_LABELS,
    DOCUMENT_FORMATS,
    DOCUMENT_PERIOD_LABELS,
    DOCUMENT_PERIODS,
    DOCUMENT_SEARCH_MAX_LENGTH,
    DOCUMENT_SORT_LABELS,
    DOCUMENT_SORTS,
    documentFiltersQuery,
    type DocumentFilters as Filters,
    hasDocumentFilters,
} from "@/lib/documents/filters";
import { DOMAIN_KEYS, DOMAINS } from "@/lib/domains";

type Option = { value: string; label: string };

/** Typing pauses this long before the list follows. */
const SEARCH_DELAY_MS = 300;

/**
 * Search, filters and sort of the documents (US-12). They are kept in the
 * URL, like those of the action plan; the list follows without moving the
 * focus, and the number of documents is read by screen readers.
 */
export function DocumentFilters({
    filters,
    authors,
    count,
}: {
    filters: Filters;
    authors: ActionPerson[];
    count: number;
}) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    // Shows the choice at once, while the list is loading.
    const [current, setCurrent] = useOptimistic(filters);
    const [search, setSearch] = useState(filters.q ?? "");
    const searchField = useRef<HTMLInputElement>(null);
    const searchId = useId();

    function apply(next: Filters) {
        startTransition(() => {
            setCurrent(next);
            router.replace(`/documents${documentFiltersQuery(next)}`, {
                scroll: false,
            });
        });
    }

    // The list follows the search once typing pauses.
    const searchFor = useEffectEvent((q: string | undefined) => {
        if (q !== current.q) apply({ ...current, q });
    });
    useEffect(() => {
        const timer = setTimeout(
            () => searchFor(search.trim() || undefined),
            SEARCH_DELAY_MS,
        );
        return () => clearTimeout(timer);
    }, [search]);

    function change(name: keyof Filters, value: string) {
        apply({ ...current, [name]: value || undefined });
    }

    function reset() {
        setSearch("");
        apply({ sort: current.sort });
        // The button disappears: the focus must not be lost with it.
        searchField.current?.focus();
    }

    return (
        <div
            role="group"
            aria-label="Filtrer les justificatifs"
            className="flex flex-col gap-3"
        >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <div className="col-span-2 flex min-w-0 flex-col gap-1.5 lg:col-span-3 xl:col-span-1">
                    <label htmlFor={searchId} className="text-sm font-medium">
                        Nom
                    </label>
                    <div className="relative">
                        <Search
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
                        />
                        <Input
                            ref={searchField}
                            id={searchId}
                            type="search"
                            placeholder="Rechercher"
                            maxLength={DOCUMENT_SEARCH_MAX_LENGTH}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
                <Filter
                    label="Format"
                    value={current.format}
                    onChange={(value) => change("format", value)}
                    allLabel="Tous"
                    options={DOCUMENT_FORMATS.map((format) => ({
                        value: format,
                        label: DOCUMENT_FORMAT_LABELS[format],
                    }))}
                />
                <Filter
                    label="Domaine"
                    value={current.domain}
                    onChange={(value) => change("domain", value)}
                    allLabel="Tous"
                    options={DOMAIN_KEYS.map((domain) => ({
                        value: domain,
                        label: DOMAINS[domain].label,
                    }))}
                />
                <Filter
                    label="Déposé par"
                    value={current.author}
                    onChange={(value) => change("author", value)}
                    allLabel="Tout le monde"
                    options={authors.map((author) => ({
                        value: author.id,
                        label: personName(author),
                    }))}
                />
                <Filter
                    label="Période"
                    value={current.period}
                    onChange={(value) => change("period", value)}
                    allLabel="Toutes"
                    options={DOCUMENT_PERIODS.map((period) => ({
                        value: period,
                        label: DOCUMENT_PERIOD_LABELS[period],
                    }))}
                />
                <Filter
                    label="Trier par"
                    value={current.sort ?? "recent"}
                    onChange={(value) =>
                        apply({
                            ...current,
                            sort:
                                value === "recent"
                                    ? undefined
                                    : (value as Filters["sort"]),
                        })
                    }
                    options={DOCUMENT_SORTS.map((sort) => ({
                        value: sort,
                        label: DOCUMENT_SORT_LABELS[sort],
                    }))}
                />
            </div>
            <div className="flex min-h-10 flex-wrap items-center gap-3">
                <p role="status" className="text-sm text-ink-muted">
                    {count === 0
                        ? "Aucun justificatif"
                        : `${count} justificatif${count > 1 ? "s" : ""}`}
                </p>
                {hasDocumentFilters(current) && (
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
    label,
    value,
    onChange,
    allLabel,
    options: choices,
}: {
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
