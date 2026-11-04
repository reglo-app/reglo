import { redirect } from "next/navigation";

import { getSessionToken } from "@/lib/auth/session";
import type { DomainKey } from "@/lib/domains";

import { API_INTERNAL_URL } from "./internal-url";
import {
    mockActionDetails,
    mockActions,
    mockCurrentDiagnostic,
    mockCurrentUser,
    mockDiagnosticResult,
    mockDashboardSummary,
    mockDomainDetails,
    mockInvitations,
    mockMembers,
    mockNewsArticles,
    mockQuestionnaire,
} from "./mocks";
import type {
    Action,
    ActionDetail,
    CurrentDiagnostic,
    CurrentUser,
    DashboardSummary,
    DiagnosticResult,
    DomainDetail,
    Invitation,
    Member,
    NewsArticle,
    Questionnaire,
} from "./types";

/** Parts of the app that can still run on mock data. */
export const API_FEATURES = [
    "me",
    "team",
    "diagnostic",
    "actions",
    "dashboard",
    "domains",
    "news",
] as const;
export type ApiFeature = (typeof API_FEATURES)[number];

/** Features whose API endpoints do not exist yet. */
const DEFAULT_MOCKS: readonly ApiFeature[] = ["dashboard", "domains", "news"];

/**
 * Reads API_MOCKS: "all", "none" or a comma-separated list of features
 * (e.g. "dashboard,news"). Unset or empty: DEFAULT_MOCKS. Read by the server
 * at runtime, so it can change without rebuilding the image.
 */
export function parseMocks(value: string | undefined): Set<ApiFeature> {
    const raw = value?.trim() ?? "";
    if (raw === "") return new Set(DEFAULT_MOCKS);
    if (raw === "all") return new Set(API_FEATURES);
    if (raw === "none") return new Set();

    const names = raw.split(",").map((name) => name.trim());
    return new Set(API_FEATURES.filter((feature) => names.includes(feature)));
}

/** Error with the HTTP status. Never show `message` to users (rule 3). */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = "ApiError";
    }
}

export type Api = {
    getCurrentUser(): Promise<CurrentUser>;
    getDashboardSummary(): Promise<DashboardSummary>;
    /** null when the article does not exist (or is not visible). */
    getNewsArticle(id: string): Promise<NewsArticle | null>;
    getDomainDetail(domain: DomainKey): Promise<DomainDetail>;
    /** Members of the organization of the signed-in user. */
    getMembers(): Promise<Member[]>;
    /** Pending invitations: administrators only (403 otherwise). */
    getInvitations(): Promise<Invitation[]>;
    getQuestionnaire(): Promise<Questionnaire>;
    /** The shared draft of the organization (US-05). */
    getCurrentDiagnostic(): Promise<CurrentDiagnostic>;
    /** Score of the latest submitted diagnostic; null if never (US-06). */
    getLatestResult(): Promise<DiagnosticResult | null>;
    /** Action plan of the organization, soonest due first (US-09). */
    getActions(): Promise<Action[]>;
    /** null when the action does not exist (or is not visible). */
    getAction(id: string): Promise<ActionDetail | null>;
};

export type ApiOptions = {
    mocks: Set<ApiFeature>;
    baseUrl: string;
    /** Access token of the session (HttpOnly cookie). */
    getToken: () => Promise<string | null>;
    /** Called when the API refuses the token: must not return. */
    onUnauthorized: () => never;
};

const defaultOptions: ApiOptions = {
    mocks: parseMocks(process.env.API_MOCKS),
    baseUrl: API_INTERNAL_URL,
    getToken: getSessionToken,
    // Forgets the refused token, then shows the login page.
    onUnauthorized: () => redirect("/session-expired"),
};

export function createApi(overrides: Partial<ApiOptions> = {}): Api {
    const { mocks, baseUrl, getToken, onUnauthorized } = {
        ...defaultOptions,
        ...overrides,
    };

    async function request<T>(path: string): Promise<T> {
        const token = await getToken();
        if (!token) onUnauthorized();

        const response = await fetch(`${baseUrl}${path}`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
        });

        if (response.status === 401) onUnauthorized();
        if (!response.ok) {
            throw new ApiError(response.status, `GET ${path} failed`);
        }

        return (await response.json()) as T;
    }

    /**
     * Mock data or API call for one feature. The session is always read:
     * private pages then never get prerendered with shared data.
     */
    async function load<T>(
        feature: ApiFeature,
        mock: () => T,
        call: () => Promise<T>,
    ): Promise<T> {
        if (!mocks.has(feature)) return call();
        await getToken();
        // structuredClone: callers can never mutate the shared mock objects.
        return structuredClone(mock());
    }

    return {
        getCurrentUser: () =>
            load(
                "me",
                () => mockCurrentUser,
                () => request<CurrentUser>("/api/auth/me"),
            ),
        getMembers: () =>
            load(
                "team",
                () => mockMembers,
                () => request<Member[]>("/api/users"),
            ),
        getInvitations: () =>
            load(
                "team",
                () => mockInvitations,
                () => request<Invitation[]>("/api/invitations"),
            ),
        getQuestionnaire: () =>
            load(
                "diagnostic",
                () => mockQuestionnaire,
                () => request<Questionnaire>("/api/questionnaire"),
            ),
        getCurrentDiagnostic: () =>
            load(
                "diagnostic",
                () => mockCurrentDiagnostic,
                () => request<CurrentDiagnostic>("/api/diagnostics/current"),
            ),
        getLatestResult: () =>
            load(
                "diagnostic",
                () => mockDiagnosticResult,
                () =>
                    request<DiagnosticResult | null>(
                        "/api/diagnostics/latest/result",
                    ),
            ),
        getActions: () =>
            load(
                "actions",
                () => mockActions,
                () => request<Action[]>("/api/actions"),
            ),
        getAction: (id) =>
            load(
                "actions",
                () => mockActionDetails.find((a) => a.id === id) ?? null,
                () =>
                    orNotFound(
                        request<ActionDetail>(
                            `/api/actions/${encodeURIComponent(id)}`,
                        ),
                    ),
            ),
        getDashboardSummary: () =>
            load(
                "dashboard",
                () => mockDashboardSummary,
                () => request<DashboardSummary>("/api/dashboard"),
            ),
        getDomainDetail: (domain) =>
            load(
                "domains",
                () => mockDomainDetails[domain],
                () => request<DomainDetail>(`/api/domains/${domain}`),
            ),
        getNewsArticle: (id) =>
            load(
                "news",
                () => mockNewsArticles.find((a) => a.id === id) ?? null,
                () =>
                    orNotFound(
                        request<NewsArticle>(
                            `/api/news/${encodeURIComponent(id)}`,
                        ),
                    ),
            ),
    };
}

/** null instead of a 404: the page shows "not found". */
async function orNotFound<T>(response: Promise<T>): Promise<T | null> {
    try {
        return await response;
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
    }
}

export const api = createApi();
