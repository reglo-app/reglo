"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import type { AnswerValue, DiagnosticAnswer, Question } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const YES_NO = [
    { value: "yes", label: "Oui" },
    { value: "partial", label: "En partie" },
    { value: "no", label: "Non" },
];

/** Value of the "Non concerné" radio: never a real answer. */
const NOT_APPLICABLE = "__not_applicable";

/** Typing pause before a text answer is saved, in ms. */
const TEXT_SAVE_DELAY = 600;

export type QuestionFieldProps = {
    question: Question;
    answer: DiagnosticAnswer | undefined;
    /** Id of the heading holding the question (the group label). */
    labelledBy: string;
    /** Readers consult the answers without changing them. */
    disabled?: boolean;
    onAnswer: (value: AnswerValue | null, notApplicable: boolean) => void;
};

/**
 * The answer choices of one question, as selectable cards. They are real
 * radio buttons and checkboxes: keyboard, labels and screen readers work.
 */
export function QuestionField({
    question,
    answer,
    labelledBy,
    disabled = false,
    onAnswer,
}: QuestionFieldProps) {
    const notApplicable = answer?.notApplicable ?? false;
    const value = notApplicable ? null : (answer?.value ?? null);

    if (question.type === "text") {
        return (
            <TextAnswer
                key={question.id}
                labelledBy={labelledBy}
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                onAnswer={(text) => onAnswer(text || null, false)}
            />
        );
    }

    if (question.type === "multi_choice") {
        const selected = Array.isArray(value) ? value : [];
        const toggle = (id: string, checked: boolean) =>
            onAnswer(
                checked
                    ? [...selected.filter((other) => other !== id), id]
                    : selected.filter((other) => other !== id),
                false,
            );

        return (
            <fieldset
                aria-labelledby={labelledBy}
                className="grid gap-3 sm:grid-cols-2"
            >
                {question.options.map((option) => (
                    <ChoiceCard
                        key={option.id}
                        type="checkbox"
                        checked={selected.includes(option.id)}
                        disabled={disabled}
                        onChange={(checked) => toggle(option.id, checked)}
                    >
                        {option.label}
                    </ChoiceCard>
                ))}
                {/* An answer too: none of them is in place. */}
                <ChoiceCard
                    type="checkbox"
                    checked={Array.isArray(value) && value.length === 0}
                    disabled={disabled}
                    onChange={(checked) => onAnswer(checked ? [] : null, false)}
                    secondary
                >
                    Aucune de ces réponses
                </ChoiceCard>
                {question.allow_na && (
                    <ChoiceCard
                        type="checkbox"
                        checked={notApplicable}
                        disabled={disabled}
                        onChange={(checked) => onAnswer(null, checked)}
                        secondary
                    >
                        Non concerné
                    </ChoiceCard>
                )}
            </fieldset>
        );
    }

    const choices =
        question.type === "yes_no"
            ? YES_NO
            : question.type === "scale"
              ? question.levels.map((label, index) => ({
                    value: String(index),
                    label,
                }))
              : question.options.map((option) => ({
                    value: option.id,
                    label: option.label,
                }));
    const current = notApplicable
        ? NOT_APPLICABLE
        : value === null
          ? null
          : String(value);

    const choose = (chosen: string) => {
        if (chosen === NOT_APPLICABLE) onAnswer(null, true);
        else
            onAnswer(
                question.type === "scale" ? Number(chosen) : chosen,
                false,
            );
    };

    return (
        <fieldset
            aria-labelledby={labelledBy}
            className={cn(
                "grid gap-3",
                question.type === "yes_no"
                    ? "sm:grid-cols-3"
                    : "sm:grid-cols-2",
            )}
        >
            {choices.map((choice) => (
                <ChoiceCard
                    key={choice.value}
                    type="radio"
                    name={question.id}
                    checked={current === choice.value}
                    disabled={disabled}
                    onChange={() => choose(choice.value)}
                >
                    {choice.label}
                </ChoiceCard>
            ))}
            {question.allow_na && (
                <ChoiceCard
                    type="radio"
                    name={question.id}
                    checked={current === NOT_APPLICABLE}
                    disabled={disabled}
                    onChange={() => choose(NOT_APPLICABLE)}
                    secondary
                >
                    Non concerné
                </ChoiceCard>
            )}
        </fieldset>
    );
}

function ChoiceCard({
    type,
    name,
    checked,
    disabled,
    onChange,
    secondary = false,
    children,
}: {
    type: "radio" | "checkbox";
    name?: string;
    checked: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
    /** "Aucune", "Non concerné": dashed, apart from the real choices. */
    secondary?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label
            className={cn(
                "group flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 text-base text-ink transition-colors duration-200",
                "hover:border-border-strong has-checked:border-green-700 has-checked:bg-green-50",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring",
                "has-disabled:cursor-default has-disabled:hover:border-border has-disabled:has-checked:hover:border-green-700",
                secondary
                    ? "border-dashed border-border-strong"
                    : "border-border",
            )}
        >
            <span>{children}</span>
            <input
                type={type}
                name={name}
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                className="sr-only"
            />
            <span
                aria-hidden="true"
                className={cn(
                    "flex size-5 shrink-0 items-center justify-center border border-border-strong bg-white transition-colors duration-200 group-has-checked:border-green-700 group-has-checked:bg-green-700",
                    type === "radio" ? "rounded-full" : "rounded-sm",
                )}
            >
                {type === "radio" ? (
                    <span className="size-2 rounded-full bg-white opacity-0 transition-opacity group-has-checked:opacity-100" />
                ) : (
                    <Check
                        strokeWidth={3}
                        className="size-3.5 text-white opacity-0 transition-opacity group-has-checked:opacity-100"
                    />
                )}
            </span>
        </label>
    );
}

/** Free text, saved after a short typing pause. */
function TextAnswer({
    labelledBy,
    value,
    disabled,
    onAnswer,
}: {
    labelledBy: string;
    value: string;
    disabled: boolean;
    onAnswer: (text: string) => void;
}) {
    const [text, setText] = useState(value);
    const saved = useRef(value);

    useEffect(() => {
        if (text === saved.current) return;
        const timer = setTimeout(() => {
            saved.current = text;
            onAnswer(text.trim());
        }, TEXT_SAVE_DELAY);
        return () => clearTimeout(timer);
    }, [text, onAnswer]);

    return (
        <textarea
            aria-labelledby={labelledBy}
            value={text}
            disabled={disabled}
            maxLength={2000}
            rows={5}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-base text-ink shadow-xs focus-visible:border-green-600 focus-visible:ring-4 focus-visible:ring-brand-green/20 focus-visible:outline-none disabled:opacity-60"
        />
    );
}
