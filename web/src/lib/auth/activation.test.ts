import { afterEach, describe, expect, it, vi } from "vitest";

import { activateAccount, resendActivationLink } from "./activation";
import {
    checkActivationToken,
    requestActivationLink,
    submitActivation,
} from "./api";

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

function stubFetch(response: Response | Error) {
    const fetchMock =
        response instanceof Error
            ? vi.fn().mockRejectedValue(response)
            : vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function formData(fields: Record<string, string>) {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) {
        data.set(name, value);
    }
    return data;
}

const PASSWORD = "correct-horse-battery";

describe("activateAccount", () => {
    it("rejects a short password without calling the API", async () => {
        const fetchMock = stubFetch(new Response(null, { status: 204 }));

        expect(
            await activateAccount(
                {},
                formData({
                    token: "t",
                    password: "short",
                    confirmation: "short",
                }),
            ),
        ).toEqual({
            error: "Le mot de passe doit contenir au moins 12 caractères.",
            invalidFields: ["password"],
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a different confirmation", async () => {
        const state = await activateAccount(
            {},
            formData({
                token: "t",
                password: PASSWORD,
                confirmation: "another-password",
            }),
        );

        expect(state.invalidFields).toEqual(["confirmation"]);
    });

    it("opens the login page once the account is activated", async () => {
        const fetchMock = stubFetch(new Response(null, { status: 204 }));

        await expect(
            activateAccount(
                {},
                formData({
                    token: "abc",
                    password: PASSWORD,
                    confirmation: PASSWORD,
                }),
            ),
        ).rejects.toThrow("redirect:/login?activated=1");
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/activation$/),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ token: "abc", password: PASSWORD }),
            }),
        );
    });

    it("offers a new link when the link expired", async () => {
        stubFetch(Response.json({}, { status: 410 }));

        const state = await activateAccount(
            {},
            formData({
                token: "t",
                password: PASSWORD,
                confirmation: PASSWORD,
            }),
        );

        expect(state.linkExpired).toBe(true);
    });

    it("never shows a technical detail when the API fails", async () => {
        stubFetch(new TypeError("fetch failed"));

        expect(
            await activateAccount(
                {},
                formData({
                    token: "t",
                    password: PASSWORD,
                    confirmation: PASSWORD,
                }),
            ),
        ).toEqual({
            error: "L'opération est impossible pour le moment. Réessayez plus tard.",
        });
    });
});

describe("resendActivationLink", () => {
    it("asks for the e-mail", async () => {
        expect(
            await resendActivationLink({}, formData({ email: " " })),
        ).toEqual({ error: "Saisissez votre adresse e-mail." });
    });

    it("confirms once the API accepted the request", async () => {
        const fetchMock = stubFetch(new Response(null, { status: 202 }));

        expect(
            await resendActivationLink(
                {},
                formData({ email: " claire@acme.test " }),
            ),
        ).toEqual({ sent: true });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/activation\/resend$/),
            expect.objectContaining({
                body: JSON.stringify({ email: "claire@acme.test" }),
            }),
        );
    });
});

describe("activation API", () => {
    it("returns who the link is for", async () => {
        stubFetch(
            Response.json({
                email: "claire@acme.test",
                firstName: "Claire",
                organizationName: "Acme",
            }),
        );

        expect(await checkActivationToken("t")).toEqual({
            status: "valid",
            invite: {
                email: "claire@acme.test",
                firstName: "Claire",
                organizationName: "Acme",
            },
        });
    });

    it.each([
        [410, "invalid"],
        [500, "unavailable"],
    ])("maps a %i answer of the check to %s", async (status, expected) => {
        stubFetch(Response.json({}, { status }));
        expect(await checkActivationToken("t")).toEqual({ status: expected });
    });

    it.each([
        [204, "success"],
        [410, "invalid"],
        [422, "weak_password"],
        [500, "unavailable"],
    ])("maps a %i answer of the activation to %s", async (status, expected) => {
        stubFetch(new Response(null, { status }));
        expect(await submitActivation("t", PASSWORD)).toEqual({
            status: expected,
        });
    });

    it("reports a resend failure only when the API cannot be reached", async () => {
        stubFetch(new TypeError("fetch failed"));
        expect(await requestActivationLink("a@b.test")).toBe(false);
    });
});
