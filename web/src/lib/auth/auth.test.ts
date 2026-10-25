import { afterEach, describe, expect, it, vi } from "vitest";

import { login, logout } from "./actions";
import {
    isAccessTokenValid,
    requestAccessToken,
    revokeAccessToken,
} from "./api";
import { DEFAULT_AFTER_LOGIN, safeRedirectPath } from "./redirect";
import { clearSession, getSessionToken } from "./session";

// The session module needs a Next.js request (next/headers).
vi.mock("./session", () => ({
    setSessionToken: vi.fn(),
    getSessionToken: vi.fn(),
    clearSession: vi.fn(),
}));

// redirect() never returns: it throws, like in Next.js.
vi.mock("next/navigation", () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`redirect:${url}`);
    }),
}));

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
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
        "/session-expired",
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

describe("logout", () => {
    it("revokes the token on the API, then forgets it", async () => {
        vi.mocked(getSessionToken).mockResolvedValue("abc123");
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(logout()).rejects.toThrow("redirect:/login");

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/auth\/logout$/),
            expect.objectContaining({
                method: "POST",
                headers: { Authorization: "Bearer abc123" },
            }),
        );
        expect(clearSession).toHaveBeenCalledOnce();
    });

    it("still signs out when the API cannot be reached", async () => {
        vi.mocked(getSessionToken).mockResolvedValue("abc123");
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError()));

        await expect(logout()).rejects.toThrow("redirect:/login");
        expect(clearSession).toHaveBeenCalledOnce();
    });

    it("does not call the API without a session", async () => {
        vi.mocked(getSessionToken).mockResolvedValue(null);
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        await expect(logout()).rejects.toThrow("redirect:/login");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("revokeAccessToken / isAccessTokenValid", () => {
    it("never throws when the API cannot be reached", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError()));

        await expect(revokeAccessToken("abc123")).resolves.toBeUndefined();
        expect(await isAccessTokenValid("abc123")).toBe(false);
    });

    it("says whether the API accepts the token", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(Response.json({ id: "1" }))
                .mockResolvedValueOnce(new Response(null, { status: 401 })),
        );

        expect(await isAccessTokenValid("good")).toBe(true);
        expect(await isAccessTokenValid("revoked")).toBe(false);
    });
});
