import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionToken } from "@/lib/auth/session";

import {
    changePassword,
    confirmNewEmail,
    removeAvatar,
    requestEmailChange,
    updateProfile,
    uploadAvatar,
} from "./actions";
import { checkEmailChangeToken } from "./api";
import { avatarUrl, initials } from "./avatar";

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

function formData(fields: Record<string, string | File>) {
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

describe("updateProfile", () => {
    it("sends the trimmed fields with the session token", async () => {
        const fetchMock = stubFetch(Response.json({}));

        expect(
            await updateProfile(
                {},
                formData({
                    firstName: " Camille ",
                    lastName: "Martin",
                    jobTitle: " Responsable QHSE ",
                }),
            ),
        ).toEqual({ saved: true });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/me$/),
            expect.objectContaining({
                method: "PATCH",
                headers: expect.objectContaining({
                    Authorization: "Bearer session-token",
                }),
                body: JSON.stringify({
                    firstName: "Camille",
                    lastName: "Martin",
                    jobTitle: "Responsable QHSE",
                }),
            }),
        );
    });

    it("asks for the names without calling the API", async () => {
        const fetchMock = stubFetch(Response.json({}));

        const state = await updateProfile(
            {},
            formData({ firstName: " ", lastName: "", jobTitle: "" }),
        );

        expect(state.fieldErrors).toEqual({
            firstName: "Saisissez votre prénom.",
            lastName: "Saisissez votre nom.",
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("shows the fields refused by the API", async () => {
        stubFetch(
            rejection(422, "invalid_profile", "Trop long.", {
                fields: { jobTitle: "Trop long." },
            }),
        );

        expect(
            await updateProfile(
                {},
                formData({ firstName: "A", lastName: "B", jobTitle: "C" }),
            ),
        ).toEqual({
            error: "Trop long.",
            fieldErrors: { jobTitle: "Trop long." },
        });
    });

    it("never shows a technical detail when the API fails", async () => {
        stubFetch(new TypeError("fetch failed"));

        expect(
            await updateProfile(
                {},
                formData({ firstName: "A", lastName: "B", jobTitle: "" }),
            ),
        ).toEqual({ error: UNAVAILABLE });
    });

    it("opens the login page when the session is refused", async () => {
        stubFetch(new Response(null, { status: 401 }));

        await expect(
            updateProfile(
                {},
                formData({ firstName: "A", lastName: "B", jobTitle: "" }),
            ),
        ).rejects.toThrow("redirect:/session-expired");
    });
});

describe("changePassword", () => {
    const valid = {
        currentPassword: "old-password-1",
        newPassword: "correct-horse-battery",
        confirmation: "correct-horse-battery",
    };

    it("changes the password", async () => {
        const fetchMock = stubFetch(new Response(null, { status: 204 }));

        expect(await changePassword({}, formData(valid))).toEqual({
            saved: true,
        });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/me\/password$/),
            expect.objectContaining({
                body: JSON.stringify({
                    currentPassword: "old-password-1",
                    newPassword: "correct-horse-battery",
                }),
            }),
        );
    });

    it.each([
        [{ ...valid, currentPassword: "" }, "currentPassword"],
        [
            { ...valid, newPassword: "short", confirmation: "short" },
            "newPassword",
        ],
        [{ ...valid, confirmation: "something-else-1" }, "confirmation"],
    ])("checks the fields before calling the API", async (fields, field) => {
        const fetchMock = stubFetch(new Response(null, { status: 204 }));

        const state = await changePassword({}, formData(fields));

        expect(state.invalidFields).toEqual([field]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("marks the current password when the API refuses it", async () => {
        stubFetch(
            rejection(422, "wrong_password", "Mot de passe actuel incorrect."),
        );

        expect(await changePassword({}, formData(valid))).toEqual({
            error: "Mot de passe actuel incorrect.",
            invalidFields: ["currentPassword"],
        });
    });
});

describe("requestEmailChange", () => {
    it("confirms the sending", async () => {
        const fetchMock = stubFetch(new Response(null, { status: 202 }));

        expect(
            await requestEmailChange(
                {},
                formData({
                    email: " new@acme.test ",
                    currentPassword: "pass",
                }),
            ),
        ).toEqual({ sentTo: "new@acme.test" });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/me\/email$/),
            expect.objectContaining({
                body: JSON.stringify({
                    email: "new@acme.test",
                    currentPassword: "pass",
                }),
            }),
        );
    });

    it.each([
        ["wrong_password", "currentPassword"],
        ["invalid_email", "email"],
        ["same_email", "email"],
    ])("marks the field of a %s answer", async (code, field) => {
        stubFetch(rejection(422, code, "Message."));

        const state = await requestEmailChange(
            {},
            formData({ email: "new@acme.test", currentPassword: "pass" }),
        );

        expect(state).toEqual({ error: "Message.", invalidFields: [field] });
    });
});

describe("uploadAvatar", () => {
    function image(type: string, bytes = 10) {
        return new File([new Uint8Array(bytes)], "photo", { type });
    }

    it("sends the image as a multipart form", async () => {
        const fetchMock = stubFetch(Response.json({}));

        expect(
            await uploadAvatar({}, formData({ file: image("image/png") })),
        ).toEqual({});

        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect(init.body).toBeInstanceOf(FormData);
        expect(init.headers).not.toHaveProperty("Content-Type");
    });

    it.each([
        [image("application/pdf"), "Choisissez une image JPEG, PNG ou WebP."],
        [
            image("image/jpeg", 5 * 1024 * 1024 + 1),
            "L'image ne doit pas dépasser 5 Mo.",
        ],
    ])("refuses a wrong file before sending it", async (file, error) => {
        const fetchMock = stubFetch(Response.json({}));

        expect(await uploadAvatar({}, formData({ file }))).toEqual({ error });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("shows the message of the API", async () => {
        stubFetch(rejection(422, "invalid_image", "Image illisible."));

        expect(
            await uploadAvatar({}, formData({ file: image("image/png") })),
        ).toEqual({ error: "Image illisible." });
    });
});

describe("removeAvatar", () => {
    it("deletes the photo", async () => {
        const fetchMock = stubFetch(new Response(null, { status: 204 }));

        expect(await removeAvatar()).toEqual({});
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/me\/avatar$/),
            expect.objectContaining({ method: "DELETE" }),
        );
    });
});

describe("e-mail confirmation link", () => {
    it("confirms without session", async () => {
        const fetchMock = stubFetch(new Response(null, { status: 204 }));

        expect(await confirmNewEmail({}, formData({ token: "abc" }))).toEqual({
            confirmed: true,
        });
        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect(init.headers).not.toHaveProperty("Authorization");
    });

    it("tells when the link expired", async () => {
        stubFetch(rejection(410, "invalid_token", "Lien expiré."));

        expect(await confirmNewEmail({}, formData({ token: "t" }))).toEqual({
            error: "Lien expiré.",
            expired: true,
        });
    });

    it("tells when the address was taken meanwhile", async () => {
        stubFetch(rejection(409, "email_unavailable", "Plus disponible."));

        expect(await confirmNewEmail({}, formData({ token: "t" }))).toEqual({
            error: "Plus disponible.",
            expired: false,
        });
    });

    it.each([
        [Response.json({ newEmail: "new@acme.test" }), "valid"],
        [rejection(410, "invalid_token", "Lien expiré."), "invalid"],
        [new Response(null, { status: 500 }), "unavailable"],
    ])("checks the link (%#)", async (response, status) => {
        stubFetch(response);

        expect((await checkEmailChangeToken("t")).status).toBe(status);
    });
});

describe("avatar helpers", () => {
    it("builds a versioned URL, or none without photo", () => {
        expect(avatarUrl({ id: "7", avatarVersion: "1793" })).toBe(
            "/avatars/7?v=1793",
        );
        expect(avatarUrl({ id: "7", avatarVersion: null })).toBeNull();
    });

    it("keeps two initials", () => {
        expect(initials("Camille Anne Martin")).toBe("CA");
        expect(initials("ana@demo.test")).toBe("A");
    });
});
