import { redirect } from "next/navigation";

import { getSessionToken } from "@/lib/auth/session";
import type { DomainKey } from "@/lib/domains";

import { API_INTERNAL_URL } from "./internal-url";
import {
    mockCurrentUser,
    mockDashboardSummary,
    mockDomainDetails,
    mockNewsArticles,
} from "./mocks";
import type {
    CurrentUser,
    DashboardSummary,
    DomainDetail,
    NewsArticle,
} from "./types";

/** Parts of the app that can still run on mock data. */
export const API_FEATURES = ["me", "dashboard", "domains", "news"] as const;
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
                async () => {
                    try {
                        return await request<NewsArticle>(
                            `/api/news/${encodeURIComponent(id)}`,
                        );
                    } catch (error) {
                        if (error instanceof ApiError && error.status === 404) {
                            return null;
                        }
                        throw error;
                    }
                },
            ),
    };
}

export const api = createApi();
