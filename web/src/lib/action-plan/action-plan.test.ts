import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockActions, mockCurrentUser } from "@/lib/api/mocks";
import { getSessionToken } from "@/lib/auth/session";

import { changeActionStatus, deleteAction, saveAction } from "./actions";
import {
    canChangeStatus,
    personName,
    statusMoves,
    todayInFrance,
} from "./labels";

vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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

function form(values: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(values)) {
        data.set(name, value);
    }
    return data;
}

const VALID = {
    title: "  Mettre à jour le DUERP ",
    description: "",
    domain: "safety",
    type: "corrective",
    assigneeId: "7",
    dueDate: "2026-12-01",
};

describe("action plan labels", () => {
    it("moves one step forward or back", () => {
        expect(statusMoves("todo")).toEqual({
            previous: null,
            next: "in_progress",
        });
        expect(statusMoves("in_review")).toEqual({
            previous: "in_progress",
            next: "done",
        });
        expect(statusMoves("done")).toEqual({
            previous: "in_review",
            next: null,
        });
    });

    it("lets the assignee or an administrator change the status", () => {
        const [, assignedToHugo] = mockActions;
        const member = { ...mockCurrentUser, role: "member" as const };

        expect(canChangeStatus(assignedToHugo, mockCurrentUser)).toBe(true);
        expect(canChangeStatus(assignedToHugo, member)).toBe(false);
        expect(
            canChangeStatus(assignedToHugo, {
                ...member,
                id: assignedToHugo.assignee!.id,
            }),
        ).toBe(true);
    });

    it("names a person, or gives their e-mail", () => {
        expect(
            personName({
                id: "1",
                firstName: "Hugo",
                lastName: "Bernard",
                email: "h@b.test",
            }),
        ).toBe("Hugo Bernard");
        expect(
            personName({
                id: "1",
                firstName: null,
                lastName: null,
                email: "h@b.test",
            }),
        ).toBe("h@b.test");
    });

    it("gives today's date in France", () => {
        // 23:30 in UTC is already the next day in Paris.
        expect(todayInFrance(new Date("2026-11-04T23:30:00Z"))).toBe(
            "2026-11-05",
        );
    });
});

describe("action plan server actions", () => {
    it("creates the action, then opens it", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(Response.json({ id: "12" }, { status: 201 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(saveAction(null, {}, form(VALID))).rejects.toThrow(
            "redirect:/actions/12",
        );
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/actions$/),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    ...VALID,
                    title: "Mettre à jour le DUERP",
                }),
            }),
        );
    });

    it("saves the changes of an existing action", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(Response.json({ id: "12" }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(saveAction("12", {}, form(VALID))).rejects.toThrow(
            "redirect:/actions/12",
        );
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/actions\/12$/),
            expect.objectContaining({ method: "PATCH" }),
        );
    });

    it("gives the message of each refused field", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                Response.json(
                    {
                        error: "L'action n'est pas enregistrée : corrigez les champs signalés.",
                        code: "invalid_action",
                        fields: {
                            dueDate:
                                "L'échéance ne peut pas être dans le passé.",
                        },
                    },
                    { status: 422 },
                ),
            ),
        );

        expect(await saveAction(null, {}, form(VALID))).toEqual({
            error: "L'action n'est pas enregistrée : corrigez les champs signalés.",
            fieldErrors: {
                dueDate: "L'échéance ne peut pas être dans le passé.",
            },
        });
    });

    it("never shows a technical detail when the API is down", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(new TypeError("fetch failed")),
        );

        expect(await saveAction(null, {}, form(VALID))).toEqual({
            error: "L'enregistrement est impossible pour le moment. Réessayez dans un instant.",
        });
        expect(await changeActionStatus("12", "done")).toEqual({
            error: "L'enregistrement est impossible pour le moment. Réessayez dans un instant.",
        });
    });

    it("moves the status, or says why it is refused", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(Response.json({ id: "12" }))
            .mockResolvedValueOnce(
                Response.json(
                    {
                        error: "Seuls le responsable de l'action et les administrateurs peuvent changer son statut.",
                        code: "status_forbidden",
                    },
                    { status: 403 },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        expect(await changeActionStatus("12", "in_progress")).toEqual({
            ok: true,
        });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/actions\/12\/status$/),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ status: "in_progress" }),
            }),
        );
        expect(await changeActionStatus("12", "in_progress")).toEqual({
            error: "Seuls le responsable de l'action et les administrateurs peuvent changer son statut.",
        });
    });

    it("deletes the action, then opens the action plan", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(deleteAction("12")).rejects.toThrow("redirect:/actions");
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/actions\/12$/),
            expect.objectContaining({ method: "DELETE" }),
        );
    });
});
