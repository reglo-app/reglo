import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mockQuestionnaire } from "@/lib/api/mocks";
import type { CurrentDiagnostic, Diagnostic, Question } from "@/lib/api/types";

import { DiagnosticWizard } from "./diagnostic-wizard";
import { QuestionField } from "./question-field";

const NO_DIAGNOSTIC: CurrentDiagnostic = { draft: null, lastSubmittedAt: null };

function draft(answers: Diagnostic["answers"]): CurrentDiagnostic {
    return {
        draft: {
            id: "1",
            status: "draft",
            questionnaireVersion: "mock-1",
            startedAt: "2026-11-03T09:00:00+00:00",
            updatedAt: "2026-11-03T09:00:00+00:00",
            submittedAt: null,
            answers,
        },
        lastSubmittedAt: null,
    };
}

function renderWizard(
    current: CurrentDiagnostic,
    overrides: Partial<Parameters<typeof DiagnosticWizard>[0]> = {},
) {
    const saveAnswer = vi.fn().mockResolvedValue({ ok: true });
    const submit = vi
        .fn()
        .mockResolvedValue({ submittedAt: "2026-11-03T15:00:00+00:00" });
    render(
        <DiagnosticWizard
            questionnaire={mockQuestionnaire}
            current={current}
            canEdit
            saveAnswer={saveAnswer}
            submit={submit}
            {...overrides}
        />,
    );
    return { saveAnswer, submit };
}

/** Every mock question answered, except the ones given. */
function allAnsweredBut(...missing: string[]): Diagnostic["answers"] {
    return Object.fromEntries(
        mockQuestionnaire.pillars
            .flatMap((pillar) => pillar.themes)
            .flatMap((theme) => theme.questions)
            .filter((question) => !missing.includes(question.id))
            .map((question) => [
                question.id,
                { value: null, notApplicable: true },
            ]),
    );
}

describe("QuestionField", () => {
    function renderField(question: Question, onAnswer = vi.fn()) {
        render(
            <>
                <h2 id="q">{question.label}</h2>
                <QuestionField
                    question={question}
                    answer={undefined}
                    labelledBy="q"
                    onAnswer={onAnswer}
                />
            </>,
        );
        return onAnswer;
    }

    it("answers a yes / no question in its format", async () => {
        const onAnswer = renderField({ id: "a", label: "Q ?", type: "yes_no" });

        expect(screen.getByRole("group", { name: "Q ?" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("radio", { name: "En partie" }));

        expect(onAnswer).toHaveBeenCalledWith("partial", false);
    });

    it("gives the level index of a scale", async () => {
        const onAnswer = renderField({
            id: "a",
            label: "Q ?",
            type: "scale",
            levels: ["Jamais", "Parfois", "Toujours"],
        });

        await userEvent.click(screen.getByRole("radio", { name: "Toujours" }));

        expect(onAnswer).toHaveBeenCalledWith(2, false);
    });

    it("lets several choices be made, or none of them, or not applicable", async () => {
        const onAnswer = renderField({
            id: "a",
            label: "Q ?",
            type: "multi_choice",
            allow_na: true,
            options: [
                { id: "x", label: "Choix X" },
                { id: "y", label: "Choix Y" },
            ],
        });

        await userEvent.click(
            screen.getByRole("checkbox", { name: "Choix Y" }),
        );
        expect(onAnswer).toHaveBeenLastCalledWith(["y"], false);

        await userEvent.click(
            screen.getByRole("checkbox", { name: "Aucune de ces réponses" }),
        );
        expect(onAnswer).toHaveBeenLastCalledWith([], false);

        await userEvent.click(
            screen.getByRole("checkbox", { name: "Non concerné" }),
        );
        expect(onAnswer).toHaveBeenLastCalledWith(null, true);
    });

    it("offers not applicable only where it is allowed", () => {
        renderField({ id: "a", label: "Q ?", type: "yes_no" });

        expect(
            screen.queryByRole("radio", { name: "Non concerné" }),
        ).not.toBeInTheDocument();
    });
});

describe("DiagnosticWizard", () => {
    it("starts with the introduction, then the first question", async () => {
        renderWizard(NO_DIAGNOSTIC);

        expect(
            screen.getByRole("heading", {
                name: "Faisons le point sur votre démarche QHSE",
            }),
        ).toHaveFocus();
        expect(
            screen.getByText("8 questions sur les quatre domaines", {
                exact: false,
            }),
        ).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: "Commencer le diagnostic" }),
        );

        expect(
            screen.getByRole("heading", {
                name: "Votre entreprise a-t-elle fixé des objectifs qualité mesurables ?",
            }),
        ).toHaveFocus();
        expect(screen.getByText("Question 1 sur 8")).toBeInTheDocument();
    });

    it("resumes a draft at the first unanswered question", () => {
        renderWizard(
            draft({
                "quality.pilotage.01": { value: "yes", notApplicable: false },
            }),
        );

        expect(screen.getByText("Question 2 sur 8")).toBeInTheDocument();
        expect(
            screen.getByRole("progressbar", {
                name: "Avancement du diagnostic",
            }),
        ).toHaveAttribute("aria-valuetext", "1 questions répondues sur 8");
    });

    it("saves each answer at once and says so", async () => {
        const { saveAnswer } = renderWizard(draft({}));

        await userEvent.click(screen.getByRole("radio", { name: "Oui" }));

        expect(saveAnswer).toHaveBeenCalledWith(
            "quality.pilotage.01",
            "yes",
            false,
        );
        expect(
            await screen.findByText("Réponse enregistrée"),
        ).toBeInTheDocument();
    });

    it("offers to try again when saving failed", async () => {
        const saveAnswer = vi
            .fn()
            .mockResolvedValueOnce({ error: "Enregistrement impossible." })
            .mockResolvedValueOnce({ ok: true });
        renderWizard(draft({}), { saveAnswer });

        await userEvent.click(screen.getByRole("radio", { name: "Non" }));
        expect(
            await screen.findByText("Enregistrement impossible."),
        ).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: "Réessayer" }),
        );

        expect(
            await screen.findByText("Réponse enregistrée"),
        ).toBeInTheDocument();
        expect(saveAnswer).toHaveBeenCalledTimes(2);
        expect(saveAnswer).toHaveBeenLastCalledWith(
            "quality.pilotage.01",
            "no",
            false,
        );
    });

    it("moves between questions without answering", async () => {
        renderWizard(draft({}));

        await userEvent.click(screen.getByRole("button", { name: "Suivant" }));
        expect(screen.getByText("Question 2 sur 8")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Retour" }));
        expect(screen.getByText("Question 1 sur 8")).toBeInTheDocument();
    });

    it("shows the answers read-only to a reader", () => {
        renderWizard(
            draft({
                "quality.pilotage.01": { value: "yes", notApplicable: false },
            }),
            { canEdit: false },
        );

        expect(screen.getByText(/Lecture seule/)).toBeInTheDocument();
    });

    it("lists the missing questions and leads to them", async () => {
        const { submit } = renderWizard(
            draft(allAnsweredBut("safety.risques.01")),
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Voir le récapitulatif" }),
        );

        expect(
            screen.getByRole("button", { name: "Valider le diagnostic" }),
        ).toBeDisabled();
        await userEvent.click(screen.getByRole("button", { name: /DUERP/ }));
        expect(screen.getByText("Question 5 sur 8")).toBeInTheDocument();
        expect(submit).not.toHaveBeenCalled();
    });

    it("submits a complete diagnostic", async () => {
        const { submit } = renderWizard(draft(allAnsweredBut()));

        expect(screen.getByText("Question 8 sur 8")).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("button", { name: "Récapitulatif" }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Valider le diagnostic" }),
        );

        expect(submit).toHaveBeenCalled();
        expect(
            await screen.findByRole("heading", { name: "Diagnostic validé" }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/enregistrées le 3 nov\. 2026/),
        ).toBeInTheDocument();
    });
});
