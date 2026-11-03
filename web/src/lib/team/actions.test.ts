import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionToken } from "@/lib/auth/session";

import {
    acceptInvitation,
    cancelInvitation,
    changeMemberRole,
    inviteMember,
    removeMember,
    resendInvitation,
} from "./actions";
import { checkInvitationToken } from "./api";

// The session module needs a Next.js request (next/headers).
vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// redirect() never returns: it throws, like in Next.js.
vi.mock("next/navigation", () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`redirect:${url}`);
    }),
}));

beforeEach(() => {
    vi.mocked(getSessionToken).mockResolvedValue("session-token");
});

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

function rejection(status: number, code: string, error: string, extra = {}) {
    return Response.json({ error, code, ...extra }, { status });
}

const UNAVAILABLE =
    "L'opération est impossible pour le moment. Réessayez plus tard.";

describe("inviteMember", () => {
    it("sends the trimmed fields as the signed-in administrator", async () => {
        const fetchMock = stubFetch(
            Response.json(
                { email: "paul@acme.test", emailSent: true },
                { status: 201 },
            ),
        );

        expect(
            await inviteMember(
                {},
                formData({
                    email: " paul@acme.test ",
                    firstName: " Paul ",
                    lastName: "",
                }),
            ),
        ).toEqual({ sentTo: "paul@acme.test" });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/invitations$/),
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    Authorization: "Bearer session-token",
                }),
                body: JSON.stringify({
                    email: "paul@acme.test",
                    firstName: "Paul",
                    lastName: "",
                    // Member when the form sends none
                    role: "member",
                }),
            }),
        );
    });

    it("tells when the e-mail could not be sent", async () => {
        stubFetch(
            Response.json(
                { email: "paul@acme.test", emailSent: false },
                { status: 201 },
            ),
        );

        expect(
            await inviteMember({}, formData({ email: "paul@acme.test" })),
        ).toEqual({ notSentTo: "paul@acme.test" });
    });

    it("asks for the address without calling the API", async () => {
        const fetchMock = stubFetch(Response.json({}));

        const state = await inviteMember({}, formData({ email: " " }));

        expect(state.fieldErrors?.email).toBeDefined();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(["email_unavailable", "already_invited"])(
        "marks the address for a %s answer",
        async (code) => {
            stubFetch(rejection(422, code, "Message."));

            expect(
                await inviteMember({}, formData({ email: "paul@acme.test" })),
            ).toEqual({
                error: "Message.",
                fieldErrors: { email: "Message." },
            });
        },
    );

    it("marks the fields named by the API", async () => {
        stubFetch(
            rejection(422, "invalid_invitation", "Trop long.", {
                fields: { lastName: "Trop long." },
            }),
        );

        expect(
            await inviteMember({}, formData({ email: "paul@acme.test" })),
        ).toEqual({
            error: "Trop long.",
            fieldErrors: { lastName: "Trop long." },
        });
    });

    it("marks no field when too many invitations were sent", async () => {
        stubFetch(
            rejection(429, "too_many_invitations", "Réessayez plus tard."),
        );

        expect(
            await inviteMember({}, formData({ email: "paul@acme.test" })),
        ).toEqual({ error: "Réessayez plus tard.", fieldErrors: {} });
    });

    it("never shows a technical detail", async () => {
        stubFetch(new TypeError("fetch failed"));

        expect(
            await inviteMember({}, formData({ email: "paul@acme.test" })),
        ).toEqual({ error: UNAVAILABLE });
    });

    it("opens the login page when the session is refused", async () => {
        stubFetch(new Response(null, { status: 401 }));

        await expect(
            inviteMember({}, formData({ email: "paul@acme.test" })),
        ).rejects.toThrow("redirect:/session-expired");
    });
});

describe("changeMemberRole and removeMember", () => {
    it("changes the role", async () => {
        const fetchMock = stubFetch(Response.json({ role: "reader" }));

        expect(await changeMemberRole("4", "reader", "Paul Martin")).toEqual({
            done: "Paul Martin est maintenant lecteur.",
        });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/users\/4$/),
            expect.objectContaining({
                method: "PATCH",
                body: JSON.stringify({ role: "reader" }),
            }),
        );
    });

    it("shows why the role cannot change", async () => {
        stubFetch(rejection(422, "last_admin", "Gardez un administrateur."));

        expect(await changeMemberRole("1", "member", "Claire")).toEqual({
            error: "Gardez un administrateur.",
        });
    });

    it("removes a member", async () => {
        const fetchMock = stubFetch(new Response(null, { status: 204 }));

        expect(await removeMember("4", "Paul Martin")).toEqual({
            done: "Paul Martin ne fait plus partie de l'équipe.",
        });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/users\/4$/),
            expect.objectContaining({ method: "DELETE" }),
        );
    });

    it("treats a member already removed as removed", async () => {
        stubFetch(rejection(404, "not_found", "Ce membre n'existe plus."));

        expect(await removeMember("4", "Paul Martin")).toEqual({
            done: "Paul Martin ne fait plus partie de l'équipe.",
        });
    });

    it("never shows a technical detail", async () => {
        stubFetch(new TypeError("fetch failed"));

        expect(await removeMember("4", "Paul Martin")).toEqual({
            error: UNAVAILABLE,
        });
    });
});

describe("resendInvitation and cancelInvitation", () => {
    it("sends the invitation again", async () => {
        const fetchMock = stubFetch(Response.json({ emailSent: true }));

        expect(await resendInvitation("4", "paul@acme.test")).toEqual({
            done: "Invitation renvoyée à paul@acme.test.",
        });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/invitations\/4\/resend$/),
            expect.objectContaining({ method: "POST" }),
        );
    });

    it("tells when the new e-mail could not be sent", async () => {
        stubFetch(Response.json({ emailSent: false }));

        expect(await resendInvitation("4", "paul@acme.test")).toEqual({
            error: UNAVAILABLE,
        });
    });

    it("cancels the invitation", async () => {
        const fetchMock = stubFetch(new Response(null, { status: 204 }));

        expect(await cancelInvitation("4", "paul@acme.test")).toEqual({
            done: "Invitation de paul@acme.test annulée.",
        });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/invitations\/4$/),
            expect.objectContaining({ method: "DELETE" }),
        );
    });

    it("treats an invitation already gone as cancelled", async () => {
        stubFetch(
            rejection(404, "not_found", "Cette invitation n'existe plus."),
        );

        expect(await cancelInvitation("4", "paul@acme.test")).toEqual({
            done: "Invitation de paul@acme.test annulée.",
        });
    });

    it("shows the message of a refusal", async () => {
        stubFetch(
            rejection(429, "too_many_invitations", "Réessayez plus tard."),
        );

        expect(await resendInvitation("4", "paul@acme.test")).toEqual({
            error: "Réessayez plus tard.",
        });
    });
});

describe("acceptInvitation", () => {
    const valid = {
        token: "abc",
        firstName: " Paul ",
        lastName: "Martin",
        password: "correct-horse-battery",
        confirmation: "correct-horse-battery",
    };

    it("creates the account without session, then opens the login page", async () => {
        const fetchMock = stubFetch(
            Response.json({ email: "paul@acme.test" }, { status: 201 }),
        );

        await expect(acceptInvitation({}, formData(valid))).rejects.toThrow(
            "redirect:/login?activated=1",
        );
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toMatch(/\/api\/invitations\/accept$/);
        expect(init.headers).not.toHaveProperty("Authorization");
        expect(JSON.parse(String(init.body))).toEqual({
            token: "abc",
            firstName: "Paul",
            lastName: "Martin",
            password: "correct-horse-battery",
        });
    });

    it.each([
        [{ ...valid, firstName: "" }, "firstName"],
        [{ ...valid, lastName: " " }, "lastName"],
        [{ ...valid, password: "short", confirmation: "short" }, "password"],
        [{ ...valid, confirmation: "something-else-1" }, "confirmation"],
    ])("checks the fields before calling the API", async (fields, field) => {
        const fetchMock = stubFetch(Response.json({}));

        const state = await acceptInvitation({}, formData(fields));

        expect(state.invalidFields).toEqual([field]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("tells when the link expired", async () => {
        stubFetch(rejection(410, "invalid_token", "Lien expiré."));

        const state = await acceptInvitation({}, formData(valid));

        expect(state.linkExpired).toBe(true);
        expect(state.error).toContain("Demandez une nouvelle invitation");
    });

    it("tells when the address got an account meanwhile", async () => {
        stubFetch(
            rejection(409, "email_unavailable", "Un compte existe déjà."),
        );

        expect(await acceptInvitation({}, formData(valid))).toEqual({
            error: "Un compte existe déjà.",
            invalidFields: [],
        });
    });

    it.each([
        [
            Response.json({
                email: "paul@acme.test",
                firstName: "Paul",
                lastName: null,
                organizationName: "Acme",
                inviterName: "Claire Dupont",
            }),
            "valid",
        ],
        [rejection(410, "invalid_token", "Lien expiré."), "invalid"],
        [new Response(null, { status: 500 }), "unavailable"],
        [Response.json({}), "unavailable"],
    ])("checks the link (%#)", async (response, status) => {
        stubFetch(response);

        expect((await checkInvitationToken("t")).status).toBe(status);
    });
});
