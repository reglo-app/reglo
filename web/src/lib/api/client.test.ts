import { afterEach, describe, expect, it, vi } from "vitest";

import { DOMAIN_KEYS } from "@/lib/domains";

import { ApiError, createApi } from "./client";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("mock api", () => {
    const api = createApi(true);

    it("returns a user attached to an organization", async () => {
        const user = await api.getCurrentUser();
        expect(user.role).toBe("admin");
        expect(user.organization.name).toBeTruthy();
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
    const api = createApi(false);

    it("calls the API with the session cookie", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(Response.json({ id: "1", firstName: "Ana" }));
        vi.stubGlobal("fetch", fetchMock);

        const user = await api.getCurrentUser();

        expect(user.firstName).toBe("Ana");
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/me$/),
            expect.objectContaining({ credentials: "include" }),
        );
    });

    it("returns null for an article the API does not know", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
        );
        expect(await api.getNewsArticle("news-9")).toBeNull();
    });

    it("throws an ApiError with the status on failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
        );

        await expect(api.getCurrentUser()).rejects.toMatchObject({
            name: "ApiError",
            status: 401,
        });
        await expect(api.getCurrentUser()).rejects.toBeInstanceOf(ApiError);
    });
});
