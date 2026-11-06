import { afterEach, describe, expect, it, vi } from "vitest";

import { DOMAIN_KEYS } from "@/lib/domains";

import {
    API_FEATURES,
    ApiError,
    createApi,
    parseMocks,
    type ApiOptions,
} from "./client";

afterEach(() => {
    vi.unstubAllGlobals();
});

/** Stands in for redirect(): it never returns. */
function unauthorized(): ApiOptions["onUnauthorized"] {
    return vi.fn(() => {
        throw new Error("redirected to /session-expired");
    });
}

describe("parseMocks", () => {
    it("mocks the features without endpoints by default, not the user", () => {
        for (const value of [undefined, "", "  "]) {
            expect([...parseMocks(value)]).toEqual([
                "dashboard",
                "domains",
                "news",
            ]);
        }
    });

    it("understands all, none and a list", () => {
        expect([...parseMocks("all")]).toEqual([...API_FEATURES]);
        expect([...parseMocks("none")]).toEqual([]);
        expect([...parseMocks("news, me ,unknown")]).toEqual(["me", "news"]);
    });
});

describe("mock api", () => {
    const api = createApi({
        mocks: new Set(API_FEATURES),
        getToken: async () => "token",
    });

    it("returns a user attached to an organization", async () => {
        const user = await api.getCurrentUser();
        expect(user.role).toBe("admin");
        expect(user.organization?.name).toBeTruthy();
    });

    it("returns one score per QHSE domain, between 0 and 100", async () => {
        const summary = await api.getDashboardSummary();
        expect(summary.domains.map((d) => d.domain)).toEqual([...DOMAIN_KEYS]);
        for (const { score } of summary.domains) {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
        }
    });

    it("never shares the mock objects between callers", async () => {
        const first = await api.getCurrentUser();
        first.firstName = "Modifié";
        expect((await api.getCurrentUser()).firstName).not.toBe("Modifié");
    });

    it("returns the action plan, and one action with its history", async () => {
        const overdue = await api.getActions({ due: "overdue" });
        expect(overdue.every((a) => a.isOverdue)).toBe(true);
        const overview = await api.getActionsOverview();
        expect(overview.counts.overdue).toBe(overdue.length);

        const actions = await api.getActions();
        expect(actions.length).toBeGreaterThan(0);

        const action = await api.getAction(actions[0].id);
        expect(action?.history[0].from).toBeNull();
        expect(await api.getAction("unknown")).toBeNull();
    });

    it("returns a news article by id, or null", async () => {
        const article = await api.getNewsArticle("news-1");
        expect(article?.paragraphs.length).toBeGreaterThan(0);
        expect(await api.getNewsArticle("unknown")).toBeNull();
    });

    it("returns a pillar page with its own data only", async () => {
        const detail = await api.getDomainDetail("environment");
        expect(detail.domain).toBe("environment");
        expect(detail.themes.length).toBeGreaterThan(0);
        expect(detail.actions.every((a) => a.domain === "environment")).toBe(
            true,
        );
        expect(detail.latestNews.every((n) => n.domain === "environment")).toBe(
            true,
        );
    });

    it("does not call the network", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        await api.getCurrentUser();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("http api", () => {
    function httpApi(overrides: Partial<ApiOptions> = {}) {
        return createApi({
            mocks: new Set(),
            baseUrl: "http://api:8000",
            getToken: async () => "abc123",
            onUnauthorized: unauthorized(),
            ...overrides,
        });
    }

    it("sends the session token to the API, from the server", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(Response.json({ id: "1", email: "ana@x.test" }));
        vi.stubGlobal("fetch", fetchMock);

        const user = await httpApi().getCurrentUser();

        expect(user.email).toBe("ana@x.test");
        expect(fetchMock).toHaveBeenCalledWith(
            "http://api:8000/api/auth/me",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer abc123",
                }),
            }),
        );
    });

    it("leaves the session when the API refuses the token", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
        );
        const onUnauthorized = unauthorized();

        await expect(
            httpApi({ onUnauthorized }).getCurrentUser(),
        ).rejects.toThrow("redirected");
        expect(onUnauthorized).toHaveBeenCalledOnce();
    });

    it("does not call the API without a session", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const onUnauthorized = unauthorized();

        await expect(
            httpApi({
                getToken: async () => null,
                onUnauthorized,
            }).getCurrentUser(),
        ).rejects.toThrow("redirected");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns null for an article the API does not know", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
        );
        expect(await httpApi().getNewsArticle("news-9")).toBeNull();
    });

    it("returns null for an action of another organization", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 404 }));
        vi.stubGlobal("fetch", fetchMock);

        expect(await httpApi().getAction("42")).toBeNull();
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/actions\/42$/),
            expect.anything(),
        );
    });

    it("sends the filters of the action plan to the API", async () => {
        const fetchMock = vi
            .fn()
            .mockImplementation(
                async () => new Response("[]", { status: 200 }),
            );
        vi.stubGlobal("fetch", fetchMock);

        await httpApi().getActions({ status: "todo", due: "overdue" });
        expect(fetchMock).toHaveBeenLastCalledWith(
            expect.stringMatching(/\/api\/actions\?status=todo&due=overdue$/),
            expect.anything(),
        );

        await httpApi().getActions();
        expect(fetchMock).toHaveBeenLastCalledWith(
            expect.stringMatching(/\/api\/actions$/),
            expect.anything(),
        );
    });

    it("throws an ApiError with the status on other failures", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
        );

        await expect(httpApi().getDashboardSummary()).rejects.toMatchObject({
            name: "ApiError",
            status: 500,
        });
        await expect(httpApi().getDashboardSummary()).rejects.toBeInstanceOf(
            ApiError,
        );
    });
});

describe("mixed mocks", () => {
    it("calls the API for the user while the dashboard stays on mocks", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(Response.json({ id: "1", email: "ana@x.test" }));
        vi.stubGlobal("fetch", fetchMock);
        const api = createApi({
            mocks: parseMocks(undefined),
            baseUrl: "http://api:8000",
            getToken: async () => "abc123",
            onUnauthorized: unauthorized(),
        });

        await api.getDashboardSummary();
        expect(fetchMock).not.toHaveBeenCalled();

        expect((await api.getCurrentUser()).email).toBe("ana@x.test");
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});
