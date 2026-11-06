"use client";

import { useMemo, useState } from "react";

import { normalize, PAGE_SIZE } from "@/components/team/member-table";

/** Search in the browser and pages of PAGE_SIZE, for a back office table. */
export function useTableSearch<T>(items: T[], toText: (item: T) => string) {
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);

    const found = useMemo(() => {
        const words = normalize(query.trim());
        return words
            ? items.filter((item) => normalize(toText(item)).includes(words))
            : items;
    }, [items, query, toText]);

    const pageCount = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
    // Fewer rows than before (a search, a deletion): never an empty page.
    const currentPage = Math.min(page, pageCount);

    return {
        query,
        search: (value: string) => {
            setQuery(value);
            setPage(1);
        },
        found,
        rows: found.slice(
            (currentPage - 1) * PAGE_SIZE,
            currentPage * PAGE_SIZE,
        ),
        page: currentPage,
        pageCount,
        setPage,
    };
}
