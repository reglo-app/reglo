import type { EvidenceDocument } from "@/lib/api/types";
import { DOMAIN_KEYS, type DomainKey } from "@/lib/domains";

export const DOCUMENT_FORMATS = ["pdf", "image", "spreadsheet"] as const;
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number];

export const DOCUMENT_FORMAT_LABELS: Record<DocumentFormat, string> = {
    pdf: "PDF",
    image: "Image",
    spreadsheet: "Tableur",
};

/** Same groups as DocumentRepository::FORMATS in the API. */
const FORMAT_TYPES: Record<DocumentFormat, string[]> = {
    pdf: ["application/pdf"],
    image: ["image/png", "image/jpeg"],
    spreadsheet: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
    ],
};

export const DOCUMENT_PERIODS = ["30d", "12m"] as const;
export type DocumentPeriod = (typeof DOCUMENT_PERIODS)[number];

export const DOCUMENT_PERIOD_LABELS: Record<DocumentPeriod, string> = {
    "30d": "30 derniers jours",
    "12m": "12 derniers mois",
};

export const DOCUMENT_SORTS = ["recent", "oldest", "name"] as const;
export type DocumentSort = (typeof DOCUMENT_SORTS)[number];

export const DOCUMENT_SORT_LABELS: Record<DocumentSort, string> = {
    recent: "Plus récents",
    oldest: "Plus anciens",
    name: "Nom (A → Z)",
};

/** Longest text searched, as in the API. */
export const DOCUMENT_SEARCH_MAX_LENGTH = 100;

/** Filters of the documents (US-12), kept in the URL. */
export type DocumentFilters = {
    q?: string;
    format?: DocumentFormat;
    domain?: DomainKey;
    author?: string;
    period?: DocumentPeriod;
    sort?: DocumentSort;
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
export function parseDocumentFilters(
    params: Record<string, string | string[] | undefined>,
    authorIds: readonly string[],
): DocumentFilters {
    const q =
        typeof params.q === "string"
            ? params.q.trim().slice(0, DOCUMENT_SEARCH_MAX_LENGTH)
            : "";
    const filters: DocumentFilters = {
        q: q || undefined,
        format: oneOf(DOCUMENT_FORMATS, params.format),
        domain: oneOf(DOMAIN_KEYS, params.domain),
        author: oneOf(authorIds, params.author),
        period: oneOf(DOCUMENT_PERIODS, params.period),
        sort: oneOf(DOCUMENT_SORTS, params.sort),
    };
    return Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== undefined),
    );
}

/** "?q=duerp&format=pdf", or "" without any filter. */
export function documentFiltersQuery(filters: DocumentFilters): string {
    const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => Boolean(value)),
    ).toString();
    return query === "" ? "" : `?${query}`;
}

/** Does it hide documents? The sort alone does not. */
export function hasDocumentFilters(filters: DocumentFilters): boolean {
    const { q, format, domain, author, period } = filters;
    return Boolean(q || format || domain || author || period);
}

/** Earliest upload kept by the period, as a timestamp. */
function periodStart(period: DocumentPeriod, now: Date): number {
    const start = new Date(now);
    if (period === "30d") start.setDate(start.getDate() - 30);
    else start.setMonth(start.getMonth() - 12);
    return start.getTime();
}

/**
 * The same filters as the API, for the mock data only: the API has the last
 * word.
 */
export function filterDocuments(
    documents: EvidenceDocument[],
    filters: DocumentFilters,
    now?: Date,
): EvidenceDocument[] {
    // The clock only with a period: reading it would stop the prerendering.
    const since = filters.period
        ? periodStart(filters.period, now ?? new Date())
        : null;
    const found = documents.filter(
        (document) =>
            (!filters.q ||
                document.name
                    .toLowerCase()
                    .includes(filters.q.toLowerCase())) &&
            (!filters.format ||
                FORMAT_TYPES[filters.format].includes(document.mimeType)) &&
            (!filters.domain || document.domain === filters.domain) &&
            (!filters.author || document.uploadedBy?.id === filters.author) &&
            (since === null || Date.parse(document.createdAt) >= since),
    );
    const byDate = (a: EvidenceDocument, b: EvidenceDocument) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt);

    switch (filters.sort) {
        case "oldest":
            return found.sort(byDate);
        case "name":
            return found.sort((a, b) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "fr"),
            );
        default:
            return found.sort((a, b) => byDate(b, a));
    }
}
