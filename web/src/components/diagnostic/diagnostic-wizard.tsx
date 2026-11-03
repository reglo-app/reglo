"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    ArrowRight,
    CircleAlert,
    CircleCheck,
    ClipboardCheck,
    Cloud,
    LoaderCircle,
    Scale,
} from "lucide-react";

import { QuestionField } from "@/components/diagnostic/question-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type {
    AnswerValue,
    CurrentDiagnostic,
    Questionnaire,
} from "@/lib/api/types";
import {
    saveAnswer as saveAnswerAction,
    submitDiagnostic as submitAction,
} from "@/lib/diagnostic/actions";
import {
    isAnswered,
    isMandatory,
    missingSteps,
    pillarProgress,
    questionSteps,
    resumeIndex,
    type Answers,
    type PillarProgress,
} from "@/lib/diagnostic/questionnaire";
import {
    DOMAIN_FILL_CLASSES,
    DOMAIN_ICON_CLASSES,
    DOMAIN_TINT_CLASSES,
    DOMAINS,
} from "@/lib/domains";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Mode = "intro" | "questions" | "review" | "done";
type SaveState = "idle" | "saving" | "saved" | "error";

export type DiagnosticWizardProps = {
    questionnaire: Questionnaire;
    current: CurrentDiagnostic;
    /** False for readers: answers shown, never changed. */
    canEdit: boolean;
    /** Injected in tests; the server actions by default. */
    saveAnswer?: typeof saveAnswerAction;
    submit?: typeof submitAction;
};

/**
 * QHSE diagnostic (US-05): one question per screen, saved as soon as it is
 * answered, in a draft shared by the whole organization. The user can stop
 * and come back: the form resumes at the first unanswered question.
 */
export function DiagnosticWizard({
    questionnaire,
    current,
    canEdit,
    saveAnswer = saveAnswerAction,
    submit = submitAction,
}: DiagnosticWizardProps) {
    const steps = useMemo(() => questionSteps(questionnaire), [questionnaire]);
    const [answers, setAnswers] = useState<Answers>(
        current.draft?.answers ?? {},
    );
    const [mode, setMode] = useState<Mode>(
        current.draft ? "questions" : "intro",
    );
    const [index, setIndex] = useState(() =>
        resumeIndex(steps, current.draft?.answers ?? {}),
    );
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [saveError, setSaveError] = useState<string | null>(null);
    const failedSave = useRef<(() => void) | null>(null);
    const [submittedAt, setSubmittedAt] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);

    const progress = pillarProgress(steps, answers);
    const missing = missingSteps(steps, answers);
    const answeredCount = steps.filter((step) =>
        isAnswered(answers[step.question.id]),
    ).length;

    // Screen readers start on the new question or screen.
    useEffect(() => {
        headingRef.current?.focus();
    }, [index, mode]);

    const answer = useCallback(
        (
            questionId: string,
            value: AnswerValue | null,
            notApplicable: boolean,
        ) => {
            setAnswers((previous) => {
                const next = { ...previous };
                if (value === null && !notApplicable) delete next[questionId];
                else next[questionId] = { value, notApplicable };
                return next;
            });

            const send = () => {
                setSaveState("saving");
                void saveAnswer(questionId, value, notApplicable).then(
                    (result) => {
                        if ("error" in result) {
                            failedSave.current = send;
                            setSaveError(result.error);
                            setSaveState("error");
                        } else {
                            failedSave.current = null;
                            setSaveError(null);
                            setSaveState("saved");
                        }
                    },
                );
            };
            send();
        },
        [saveAnswer],
    );

    function goTo(step: number) {
        setIndex(Math.min(Math.max(step, 0), steps.length - 1));
        setMode("questions");
    }

    async function confirm() {
        setIsSubmitting(true);
        setSubmitError(null);
        const result = await submit();
        setIsSubmitting(false);
        if ("error" in result) {
            setSubmitError(result.error);
        } else {
            setSubmittedAt(result.submittedAt);
            setMode("done");
        }
    }

    function restart() {
        setAnswers({});
        setIndex(0);
        setSubmittedAt(null);
        setSaveState("idle");
        setMode("questions");
    }

    if (mode === "intro") {
        return (
            <Introduction
                headingRef={headingRef}
                progress={progress}
                questionCount={steps.length}
                lastSubmittedAt={current.lastSubmittedAt}
                canEdit={canEdit}
                onStart={() => goTo(0)}
            />
        );
    }

    if (mode === "done") {
        return (
            <Panel>
                <div className="flex flex-col items-start gap-5 py-6">
                    <span className="flex size-14 items-center justify-center rounded-full bg-green-50 text-green-700">
                        <CircleCheck aria-hidden="true" className="size-8" />
                    </span>
                    <h2
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-2xl font-semibold focus:outline-none sm:text-3xl"
                    >
                        Diagnostic validé
                    </h2>
                    <p className="max-w-xl text-ink-muted">
                        {submittedAt &&
                            `Vos réponses ont été enregistrées le ${formatDate(submittedAt)}. `}
                        Votre score QHSE sera calculé à partir de ce diagnostic.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button asChild>
                            <Link href="/dashboard">
                                Retour au tableau de bord
                            </Link>
                        </Button>
                        <Button variant="outline" onClick={restart}>
                            Commencer un nouveau diagnostic
                        </Button>
                    </div>
                </div>
            </Panel>
        );
    }

    const sidePanel = (
        <ProgressPanel
            progress={progress}
            currentPillar={
                mode === "questions" ? steps[index]?.pillar.id : null
            }
            onPillar={(firstStep) => goTo(firstStep)}
            onReview={() => setMode("review")}
            reviewing={mode === "review"}
        />
    );

    if (mode === "review") {
        return (
            <Layout aside={sidePanel}>
                <Panel>
                    <ProgressSegments
                        progress={progress}
                        currentPillar={null}
                    />
                    <div className="mt-8 flex flex-col gap-6 duration-300 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none">
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-ink-muted">
                                {answeredCount} questions répondues sur{" "}
                                {steps.length}
                            </p>
                            <h2
                                ref={headingRef}
                                tabIndex={-1}
                                className="text-2xl font-semibold focus:outline-none sm:text-3xl"
                            >
                                Récapitulatif
                            </h2>
                            <p className="text-ink-muted">
                                {missing.length === 0
                                    ? "Toutes les questions obligatoires ont une réponse. Vous pouvez valider le diagnostic : il ne sera plus modifiable."
                                    : "Répondez aux questions suivantes pour pouvoir valider le diagnostic."}
                            </p>
                        </div>

                        {missing.length > 0 && (
                            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                                {missing.map((step) => {
                                    const Icon = DOMAINS[step.pillar.id].icon;
                                    return (
                                        <li key={step.question.id}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    goTo(steps.indexOf(step))
                                                }
                                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle"
                                            >
                                                <Icon
                                                    aria-hidden="true"
                                                    className={cn(
                                                        "size-5 shrink-0",
                                                        DOMAIN_ICON_CLASSES[
                                                            step.pillar.id
                                                        ],
                                                    )}
                                                />
                                                <span className="flex-1">
                                                    {step.question.label}
                                                </span>
                                                <span className="text-sm font-medium text-green-700">
                                                    Répondre
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {submitError && (
                            <Alert variant="destructive">
                                <CircleAlert aria-hidden="true" />
                                <AlertDescription>
                                    {submitError}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                    <Footer>
                        <Button
                            variant="outline"
                            onClick={() => goTo(steps.length - 1)}
                        >
                            <ArrowLeft aria-hidden="true" />
                            Retour
                        </Button>
                        {canEdit && (
                            <Button
                                onClick={confirm}
                                disabled={missing.length > 0 || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <LoaderCircle
                                        aria-hidden="true"
                                        className="animate-spin"
                                    />
                                ) : (
                                    <ClipboardCheck aria-hidden="true" />
                                )}
                                Valider le diagnostic
                            </Button>
                        )}
                    </Footer>
                </Panel>
            </Layout>
        );
    }

    const step = steps[index];
    const Icon = DOMAINS[step.pillar.id].icon;
    const headingId = `question-${index}`;

    return (
        <Layout aside={sidePanel}>
            <Panel>
                <ProgressSegments
                    progress={progress}
                    currentPillar={step.pillar.id}
                />
                {!canEdit && (
                    <p className="mt-6 rounded-md bg-surface-subtle px-4 py-3 text-sm text-ink-muted">
                        Lecture seule : votre rôle de lecteur permet de
                        consulter les réponses, sans les modifier.
                    </p>
                )}
                {/* Keyed: each question comes in with a short animation. */}
                <div
                    key={step.question.id}
                    className="mt-8 flex flex-col gap-6 duration-300 animate-in fade-in-0 slide-in-from-right-2 motion-reduce:animate-none"
                >
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                            <span
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-ink",
                                    DOMAIN_TINT_CLASSES[step.pillar.id],
                                )}
                            >
                                <Icon
                                    aria-hidden="true"
                                    className={cn(
                                        "size-4",
                                        DOMAIN_ICON_CLASSES[step.pillar.id],
                                    )}
                                />
                                {step.pillar.label}
                            </span>
                            <span className="text-ink-muted">
                                {step.theme.label}
                            </span>
                            <span className="text-ink-muted sm:ml-auto">
                                Question {index + 1} sur {steps.length}
                            </span>
                        </div>
                        <h2
                            id={headingId}
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-2xl leading-tight font-semibold text-balance focus:outline-none sm:text-3xl"
                        >
                            {step.question.label}
                            {!isMandatory(step.question) && (
                                <span className="text-base font-normal text-ink-muted">
                                    {" "}
                                    (facultative)
                                </span>
                            )}
                        </h2>
                        {step.question.help && (
                            <p className="text-ink-muted">
                                {step.question.help}
                            </p>
                        )}
                        {step.question.reference && (
                            <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                                <Scale
                                    aria-hidden="true"
                                    className="size-4 shrink-0"
                                />
                                {step.question.reference}
                            </p>
                        )}
                    </div>
                    <QuestionField
                        question={step.question}
                        answer={answers[step.question.id]}
                        labelledBy={headingId}
                        disabled={!canEdit}
                        onAnswer={(value, notApplicable) =>
                            answer(step.question.id, value, notApplicable)
                        }
                    />
                </div>
                <Footer>
                    <Button
                        variant="outline"
                        onClick={() =>
                            index === 0 ? setMode("intro") : goTo(index - 1)
                        }
                    >
                        <ArrowLeft aria-hidden="true" />
                        Retour
                    </Button>
                    <SaveStatus
                        state={saveState}
                        error={saveError}
                        onRetry={() => failedSave.current?.()}
                    />
                    <Button
                        onClick={() =>
                            index === steps.length - 1
                                ? setMode("review")
                                : goTo(index + 1)
                        }
                    >
                        {index === steps.length - 1
                            ? "Récapitulatif"
                            : "Suivant"}
                        <ArrowRight aria-hidden="true" />
                    </Button>
                </Footer>
            </Panel>
        </Layout>
    );
}

function Layout({
    aside,
    children,
}: {
    aside: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            {children}
            <aside className="hidden lg:sticky lg:top-6 lg:block">
                {aside}
            </aside>
        </div>
    );
}

function Panel({ children }: { children: React.ReactNode }) {
    return (
        <section className="flex min-h-[32rem] flex-col rounded-xl border border-border bg-white p-5 sm:p-8">
            {children}
        </section>
    );
}

function Footer({ children }: { children: React.ReactNode }) {
    return (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-8">
            {children}
        </div>
    );
}

/** One segment per pillar, filled with its answered share (inspiration). */
function ProgressSegments({
    progress,
    currentPillar,
}: {
    progress: PillarProgress[];
    currentPillar: string | null;
}) {
    const answered = progress.reduce((sum, p) => sum + p.answered, 0);
    const total = progress.reduce((sum, p) => sum + p.total, 0);

    return (
        <div
            role="progressbar"
            aria-label="Avancement du diagnostic"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answered}
            aria-valuetext={`${answered} questions répondues sur ${total}`}
            className="grid gap-2"
            style={{
                gridTemplateColumns: `repeat(${progress.length}, minmax(0, 1fr))`,
            }}
        >
            {progress.map(({ pillar, answered: done, total: count }) => (
                <div key={pillar.id} className="flex flex-col gap-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-teal-50">
                        <div
                            className={cn(
                                "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
                                DOMAIN_FILL_CLASSES[pillar.id],
                            )}
                            style={{ width: `${(done / count) * 100}%` }}
                        />
                    </div>
                    <span
                        className={cn(
                            "hidden truncate text-xs sm:block",
                            pillar.id === currentPillar
                                ? "font-semibold text-ink"
                                : "text-ink-muted",
                        )}
                    >
                        {pillar.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

/** Brand side panel: progress by pillar, to jump from one to another. */
function ProgressPanel({
    progress,
    currentPillar,
    onPillar,
    onReview,
    reviewing,
}: {
    progress: PillarProgress[];
    currentPillar: string | null | undefined;
    onPillar: (firstStep: number) => void;
    onReview: () => void;
    reviewing: boolean;
}) {
    return (
        <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-xl bg-brand-gradient p-6 text-white">
            <span
                aria-hidden="true"
                className="absolute -top-16 -right-16 -z-10 size-48 rounded-full bg-white/10"
            />
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Votre progression</h2>
                <p className="text-sm text-white/85">
                    Vos réponses sont enregistrées automatiquement et partagées
                    avec votre équipe.
                </p>
            </div>
            <ul className="flex flex-col gap-2">
                {progress.map(({ pillar, answered, total, firstStep }) => {
                    const Icon = DOMAINS[pillar.id].icon;
                    return (
                        <li key={pillar.id}>
                            <button
                                type="button"
                                onClick={() => onPillar(firstStep)}
                                aria-current={
                                    pillar.id === currentPillar
                                        ? "step"
                                        : undefined
                                }
                                className={cn(
                                    "flex w-full flex-col gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/10",
                                    pillar.id === currentPillar &&
                                        "bg-white/15",
                                )}
                            >
                                <span className="flex items-center gap-2 text-sm font-medium">
                                    <Icon
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                    <span className="flex-1">
                                        {pillar.label}
                                    </span>
                                    <span className="text-white/85">
                                        {answered} / {total}
                                    </span>
                                </span>
                                <span className="h-1 overflow-hidden rounded-full bg-white/25">
                                    <span
                                        className="block h-full rounded-full bg-white transition-[width] duration-500 motion-reduce:transition-none"
                                        style={{
                                            width: `${(answered / total) * 100}%`,
                                        }}
                                    />
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {!reviewing && (
                <Button
                    variant="highlight"
                    onClick={onReview}
                    className="transition duration-200"
                >
                    Voir le récapitulatif
                </Button>
            )}
        </div>
    );
}

function SaveStatus({
    state,
    error,
    onRetry,
}: {
    state: SaveState;
    error: string | null;
    onRetry: () => void;
}) {
    return (
        <div
            role="status"
            className="order-last w-full text-sm sm:order-none sm:w-auto"
        >
            {state === "saving" && (
                <span className="flex items-center gap-1.5 text-ink-muted">
                    <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                    />
                    Enregistrement…
                </span>
            )}
            {state === "saved" && (
                <span className="flex items-center gap-1.5 text-green-700">
                    <Cloud aria-hidden="true" className="size-4" />
                    Réponse enregistrée
                </span>
            )}
            {state === "error" && (
                <span className="flex flex-wrap items-center gap-1.5 text-danger">
                    <CircleAlert aria-hidden="true" className="size-4" />
                    {error}
                    <button
                        type="button"
                        onClick={onRetry}
                        className="link-underline font-medium"
                    >
                        Réessayer
                    </button>
                </span>
            )}
        </div>
    );
}

/** First screen when no diagnostic is in progress (inspiration). */
function Introduction({
    headingRef,
    progress,
    questionCount,
    lastSubmittedAt,
    canEdit,
    onStart,
}: {
    headingRef: React.RefObject<HTMLHeadingElement | null>;
    progress: PillarProgress[];
    questionCount: number;
    lastSubmittedAt: string | null;
    canEdit: boolean;
    onStart: () => void;
}) {
    const minutes = Math.max(5, Math.round(questionCount * 0.4));

    return (
        <section className="grid overflow-hidden rounded-xl border border-border bg-white lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="flex flex-col gap-6 p-6 sm:p-10">
                <div className="flex flex-col gap-3">
                    <h2
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-3xl leading-tight font-semibold text-balance focus:outline-none sm:text-4xl"
                    >
                        Faisons le point sur votre démarche QHSE
                    </h2>
                    <p className="max-w-xl text-ink-muted">
                        {questionCount} questions sur les quatre domaines,
                        environ {minutes} minutes. Vous pouvez vous arrêter à
                        tout moment : chaque réponse est enregistrée, et votre
                        équipe peut compléter le diagnostic avec vous.
                    </p>
                    {lastSubmittedAt && (
                        <p className="text-sm text-ink-muted">
                            Dernier diagnostic validé le{" "}
                            {formatDate(lastSubmittedAt)}.
                        </p>
                    )}
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                    {progress.map(({ pillar, total }) => {
                        const Icon = DOMAINS[pillar.id].icon;
                        return (
                            <li
                                key={pillar.id}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-4 py-3",
                                    DOMAIN_TINT_CLASSES[pillar.id],
                                )}
                            >
                                <Icon
                                    aria-hidden="true"
                                    className={cn(
                                        "size-6",
                                        DOMAIN_ICON_CLASSES[pillar.id],
                                    )}
                                />
                                <span className="flex-1 font-medium">
                                    {pillar.label}
                                </span>
                                <span className="text-sm whitespace-nowrap text-ink-muted">
                                    {total} questions
                                </span>
                            </li>
                        );
                    })}
                </ul>
                <div className="mt-auto">
                    {canEdit ? (
                        <Button
                            size="lg"
                            onClick={onStart}
                            className="transition duration-200"
                        >
                            Commencer le diagnostic
                            <ArrowRight aria-hidden="true" />
                        </Button>
                    ) : (
                        <p className="text-ink-muted">
                            Aucun diagnostic n&apos;est en cours. Un membre de
                            votre équipe peut en commencer un.
                        </p>
                    )}
                </div>
            </div>
            {/* Decorative: what the user gets at the end. */}
            <div
                aria-hidden="true"
                className="relative isolate hidden flex-col justify-center gap-4 overflow-hidden bg-brand-gradient p-8 text-white lg:flex"
            >
                <span className="absolute -top-20 -left-16 -z-10 size-56 rounded-full bg-white/10" />
                <span className="absolute -right-10 -bottom-24 -z-10 size-64 rounded-full bg-white/10" />
                <p className="text-sm font-medium text-white/85">
                    À la fin du diagnostic
                </p>
                <p className="text-2xl leading-snug font-semibold">
                    Un score par domaine et les actions prioritaires à mener.
                </p>
                <div className="mt-2 flex flex-col gap-2 rounded-lg bg-white/15 p-4">
                    {progress.map(({ pillar }, position) => (
                        <div
                            key={pillar.id}
                            className="flex items-center gap-3 text-sm"
                        >
                            <span className="w-28 truncate">
                                {pillar.label}
                            </span>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                                <span
                                    className="block h-full rounded-full bg-white"
                                    style={{
                                        width: `${[72, 58, 49, 77][position] ?? 60}%`,
                                    }}
                                />
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
