// Shapes of the data returned by the REGLO API (Symfony / API Platform).
// Keep them in sync with the API resources when the endpoints are built.

import type { DomainKey } from "@/lib/domains";

export type RoleKey = "admin" | "member" | "reader";

export const ROLE_LABELS: Record<RoleKey, string> = {
    admin: "Administrateur",
    member: "Membre",
    reader: "Lecteur",
};

export type Organization = {
    id: string;
    name: string;
};

/** `GET /api/me`: the signed-in user and their organization (US-02). */
export type CurrentUser = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: RoleKey;
    organization: Organization;
};

/** Score of one QHSE domain, from 0 to 100 (DATA-01 / US-06). */
export type DomainScore = {
    domain: DomainKey;
    score: number;
    /** Score of the previous diagnostic, if any. */
    previousScore: number | null;
};

export type AlertKind =
    "action_overdue" | "document_expiring" | "training_expiring";

/** Something late or about to expire (home page "Alertes" block). */
export type DashboardAlert = {
    id: string;
    kind: AlertKind;
    title: string;
    domain: DomainKey;
    /** ISO 8601 date: deadline or expiry date. */
    dueDate: string;
};

export type ActionStatus = "todo" | "in_progress" | "done";

/** Action of the action plan (US-09). */
export type ActionSummary = {
    id: string;
    title: string;
    domain: DomainKey;
    ownerName: string;
    /** ISO 8601 date. */
    dueDate: string;
    status: ActionStatus;
};

/** Regulatory news item (US-15). */
export type NewsSummary = {
    id: string;
    title: string;
    domain: DomainKey;
    /** ISO 8601 date. */
    publishedAt: string;
    /** Cover image URL, or null (a domain-coloured cover is shown). */
    imageUrl: string | null;
};

/** `GET /api/news/{id}`: one regulatory news article. */
export type NewsArticle = NewsSummary & {
    /** Short summary shown under the title. */
    summary: string;
    /** Body, one string per paragraph (plain text). */
    paragraphs: string[];
    /** Where the text comes from (official journal, ministry…). */
    sourceName: string;
    sourceUrl: string | null;
};

/** Score of one diagnostic theme of a pillar (DATA-01). */
export type ThemeScore = {
    id: string;
    label: string;
    score: number;
};

/** Evidence document close to its expiry date (US-11). */
export type ExpiringDocument = {
    id: string;
    title: string;
    /** ISO 8601 expiry date. */
    dueDate: string;
};

/** `GET /api/domains/{domain}`: everything a QHSE pillar page shows. */
export type DomainDetail = {
    /** ISO 8601 date the data was computed: "today" for due dates. */
    generatedAt: string;
    domain: DomainKey;
    /** Pillar score from 0 to 100, or null if no diagnostic yet. */
    score: number | null;
    previousScore: number | null;
    /** One entry per diagnostic theme of the pillar. */
    themes: ThemeScore[];
    /** Open actions of the pillar, soonest first (at most 5). */
    actions: ActionSummary[];
    /** Documents expiring in the next 60 days or already expired. */
    expiringDocuments: ExpiringDocument[];
    /** Latest news of the pillar (at most 3). */
    latestNews: NewsSummary[];
};

/** `GET /api/dashboard`: everything the home page shows. */
export type DashboardSummary = {
    /** ISO 8601 date the summary was computed: "today" for due dates. */
    generatedAt: string;
    /** Global score from 0 to 100, or null if no diagnostic yet. */
    globalScore: number | null;
    /** Global score of the previous diagnostic, if any. */
    previousGlobalScore: number | null;
    domains: DomainScore[];
    /** ISO 8601 date of the last diagnostic, or null if none yet. */
    lastDiagnosticAt: string | null;
    /** At most 5, most urgent first. */
    alerts: DashboardAlert[];
    /** Next open actions, soonest first (at most 5). */
    upcomingActions: ActionSummary[];
    /** Share of actions closed on time over the last 12 months, 0 to 100. */
    actionsOnTimeRate: number | null;
    /** Latest news relevant to the organization (at most 3). */
    latestNews: NewsSummary[];
};
