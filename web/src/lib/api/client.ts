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
import type { DomainKey } from "@/lib/domains";

/**
 * Mocks are used unless NEXT_PUBLIC_USE_MOCKS is "false". NEXT_PUBLIC_*
 * variables are inlined at build time. Switch the default once the API
 * endpoints exist (US-01, US-02, US-06).
 */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: { Accept: "application/json", ...init?.headers },
    });

    if (!response.ok) {
        throw new ApiError(
            response.status,
            `${init?.method ?? "GET"} ${path} failed`,
        );
    }

    return (await response.json()) as T;
}

export type Api = {
    getCurrentUser(): Promise<CurrentUser>;
    getDashboardSummary(): Promise<DashboardSummary>;
    /** null when the article does not exist (or is not visible). */
    getNewsArticle(id: string): Promise<NewsArticle | null>;
    getDomainDetail(domain: DomainKey): Promise<DomainDetail>;
};

const httpApi: Api = {
    getCurrentUser: () => request<CurrentUser>("/api/me"),
    getDashboardSummary: () => request<DashboardSummary>("/api/dashboard"),
    getDomainDetail: (domain) =>
        request<DomainDetail>(`/api/domains/${domain}`),
    getNewsArticle: async (id) => {
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
};

// structuredClone: callers can never mutate the shared mock objects.
const mockApi: Api = {
    getCurrentUser: async () => structuredClone(mockCurrentUser),
    getDashboardSummary: async () => structuredClone(mockDashboardSummary),
    getDomainDetail: async (domain) =>
        structuredClone(mockDomainDetails[domain]),
    getNewsArticle: async (id) => {
        const article = mockNewsArticles.find((a) => a.id === id);
        return article ? structuredClone(article) : null;
    },
};

export function createApi(useMocks: boolean = USE_MOCKS): Api {
    return useMocks ? mockApi : httpApi;
}

export const api = createApi();
