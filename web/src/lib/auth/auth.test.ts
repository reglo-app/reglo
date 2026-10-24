import { afterEach, describe, expect, it, vi } from "vitest";

import { login } from "./actions";
import { requestAccessToken } from "./api";
import { DEFAULT_AFTER_LOGIN, safeRedirectPath } from "./redirect";

// The session module needs a Next.js request (next/headers).
vi.mock("./session", () => ({
    setSessionToken: vi.fn(),
    clearSession: vi.fn(),
}));

afterEach(() => {
    vi.unstubAllGlobals();
});

function formData(fields: Record<string, string>) {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) {
        data.set(name, value);
    }
    return data;
}

describe("login", () => {
    it("asks for the credentials and marks only the empty fields", async () => {
        expect(
            await login({}, formData({ email: "ana@demo.test", password: "" })),
        ).toEqual({
            error: "Saisissez vos identifiants.",
            invalidFields: ["password"],
            email: "ana@demo.test",
        });
        expect(await login({}, formData({ email: "", password: "" }))).toEqual({
            error: "Saisissez vos identifiants.",
            invalidFields: ["email", "password"],
            email: "",
        });
    });

    it("marks both fields for wrong credentials", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
        );

        expect(
            await login(
                {},
                formData({ email: "ana@demo.test", password: "x" }),
            ),
        ).toEqual({
            error: "Identifiants incorrects",
            invalidFields: ["email", "password"],
            email: "ana@demo.test",
        });
    });

    it("marks no field when the problem is not the input", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
        );

        const state = await login(
            {},
            formData({ email: "ana@demo.test", password: "x" }),
        );

        expect(state.invalidFields).toBeUndefined();
        expect(state.error).toBe(
            "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
        );
    });
});

describe("safeRedirectPath", () => {
    it("keeps a path on this site", () => {
        expect(safeRedirectPath("/actions?status=todo")).toBe(
            "/actions?status=todo",
        );
    });

    it.each([
        undefined,
        null,
        "",
        "dashboard",
        "https://evil.test",
        "//evil.test",
        "/\\evil.test",
        "/login",
    ])("falls back to the dashboard for %j", (target) => {
        expect(safeRedirectPath(target)).toBe(DEFAULT_AFTER_LOGIN);
    });
});

describe("requestAccessToken", () => {
    function stubFetch(response: Response | Error) {
        const fetchMock =
            response instanceof Error
                ? vi.fn().mockRejectedValue(response)
                : vi.fn().mockResolvedValue(response);
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    it("posts the credentials as JSON and returns the token", async () => {
        const fetchMock = stubFetch(Response.json({ token: "abc" }));

        const result = await requestAccessToken("ana@demo.test", "secret");

        expect(result).toEqual({ status: "success", token: "abc" });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/auth\/login$/),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    email: "ana@demo.test",
                    password: "secret",
                }),
            }),
        );
    });

    it("reports wrong credentials", async () => {
        stubFetch(Response.json({ error: "x" }, { status: 401 }));
        expect(await requestAccessToken("a@b.test", "x")).toEqual({
            status: "invalid",
        });
    });

    it("reports too many attempts", async () => {
        stubFetch(new Response(null, { status: 429 }));
        expect(await requestAccessToken("a@b.test", "x")).toEqual({
            status: "throttled",
        });
    });

    it.each([
        ["a server error", new Response(null, { status: 500 })],
        ["a body without token", Response.json({})],
        ["a network error", new TypeError("fetch failed")],
    ])("reports the API as unavailable on %s", async (_case, response) => {
        stubFetch(response);
        expect(await requestAccessToken("a@b.test", "x")).toEqual({
            status: "unavailable",
        });
    });
});
