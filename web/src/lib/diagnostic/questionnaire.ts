import type {
    DiagnosticAnswer,
    Question,
    Questionnaire,
    QuestionnairePillar,
    QuestionnaireTheme,
} from "@/lib/api/types";

/** A question with its place in the questionnaire: one step of the form. */
export type Step = {
    question: Question;
    pillar: QuestionnairePillar;
    theme: QuestionnaireTheme;
};

export type Answers = Record<string, DiagnosticAnswer>;

/** Every question, in the order of the questionnaire. */
export function questionSteps(questionnaire: Questionnaire): Step[] {
    return questionnaire.pillars.flatMap((pillar) =>
        pillar.themes.flatMap((theme) =>
            theme.questions.map((question) => ({ question, pillar, theme })),
        ),
    );
}

export function isAnswered(answer: DiagnosticAnswer | undefined): boolean {
    return (
        answer !== undefined && (answer.notApplicable || answer.value !== null)
    );
}

export function isMandatory(question: Question): boolean {
    return question.mandatory !== false;
}

/** Mandatory steps without answer: they block the submission. */
export function missingSteps(steps: Step[], answers: Answers): Step[] {
    return steps.filter(
        (step) =>
            isMandatory(step.question) &&
            !isAnswered(answers[step.question.id]),
    );
}

/** Where to resume: the first unanswered question, else the last one. */
export function resumeIndex(steps: Step[], answers: Answers): number {
    const index = steps.findIndex(
        (step) => !isAnswered(answers[step.question.id]),
    );
    return index === -1 ? Math.max(0, steps.length - 1) : index;
}

export type PillarProgress = {
    pillar: QuestionnairePillar;
    answered: number;
    total: number;
    /** Index of its first question in the steps. */
    firstStep: number;
};

export function pillarProgress(
    steps: Step[],
    answers: Answers,
): PillarProgress[] {
    const byPillar = new Map<string, PillarProgress>();
    steps.forEach((step, index) => {
        const progress = byPillar.get(step.pillar.id) ?? {
            pillar: step.pillar,
            answered: 0,
            total: 0,
            firstStep: index,
        };
        progress.total += 1;
        if (isAnswered(answers[step.question.id])) progress.answered += 1;
        byPillar.set(step.pillar.id, progress);
    });
    return [...byPillar.values()];
}
