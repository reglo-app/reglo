import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockQuestionnaire } from "@/lib/api/mocks";
import { getSessionToken } from "@/lib/auth/session";

import { saveAnswer, submitDiagnostic } from "./actions";
import {
    missingSteps,
    pillarProgress,
    questionSteps,
    resumeIndex,
} from "./questionnaire";

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

const steps = questionSteps(mockQuestionnaire);

describe("questionnaire helpers", () => {
    it("lists every question in order, with its pillar and theme", () => {
        expect(steps).toHaveLength(8);
        expect(steps[0].question.id).toBe("quality.pilotage.01");
        expect(steps[0].pillar.id).toBe("quality");
        expect(steps[7].theme.label).toBe("Déchets");
    });

    it("resumes at the first unanswered question", () => {
        expect(resumeIndex(steps, {})).toBe(0);
        expect(
            resumeIndex(steps, {
                "quality.pilotage.01": { value: "yes", notApplicable: false },
                "quality.pilotage.02": { value: 2, notApplicable: false },
            }),
        ).toBe(2);
    });

    it("counts not applicable as answered, and the progress by pillar", () => {
        const answers = {
            "hygiene.sante.01": { value: "no", notApplicable: false },
            "hygiene.secours.02": { value: null, notApplicable: true },
            "quality.pilotage.01": { value: "yes", notApplicable: false },
        };

        expect(
            pillarProgress(steps, answers).map((p) => [
                p.pillar.id,
                p.answered,
                p.total,
                p.firstStep,
            ]),
        ).toEqual([
            ["quality", 1, 2, 0],
            ["hygiene", 2, 2, 2],
            ["safety", 0, 2, 4],
            ["environment", 0, 2, 6],
        ]);
        expect(missingSteps(steps, answers)).toHaveLength(5);
    });
});

describe("diagnostic actions", () => {
    it("saves an answer with the question id in the body", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
        vi.stubGlobal("fetch", fetchMock);

        expect(await saveAnswer("quality.pilotage.02", 3, false)).toEqual({
            ok: true,
        });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/diagnostics\/current\/answers$/),
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    questionId: "quality.pilotage.02",
                    value: 3,
                    notApplicable: false,
                }),
            }),
        );
    });

    it("never shows a technical detail when saving fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(new TypeError("fetch failed")),
        );

        const result = await saveAnswer("quality.pilotage.01", "yes", false);

        expect(result).toEqual({
            error: "L'enregistrement est impossible pour le moment. Réessayez dans un instant.",
        });
    });

    it("submits, or shows why it is refused", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    Response.json({ submittedAt: "2026-11-03T15:00:00+00:00" }),
                )
                .mockResolvedValueOnce(
                    Response.json(
                        {
                            error: "Répondez aux 2 questions.",
                            code: "incomplete",
                        },
                        { status: 422 },
                    ),
                ),
        );

        expect(await submitDiagnostic()).toEqual({
            submittedAt: "2026-11-03T15:00:00+00:00",
        });
        expect(await submitDiagnostic()).toEqual({
            error: "Répondez aux 2 questions.",
        });
    });
});
