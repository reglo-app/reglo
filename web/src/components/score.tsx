import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

/** Words for a score, so the level is never given by a number alone. */
export function scoreLevel(score: number): string {
    if (score >= 75) return "Maîtrisé";
    if (score >= 50) return "En progrès";
    return "À renforcer";
}

/** Change since the previous diagnostic: arrow + number, words for screen readers. */
export function Trend({
    score,
    previousScore,
    className,
}: {
    score: number;
    previousScore: number | null;
    /** Overrides the green / red / grey text colour (e.g. on a dark panel). */
    className?: string;
}) {
    if (previousScore === null) {
        return <span className="sr-only">Premier diagnostic</span>;
    }
    const delta = score - previousScore;
    const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
    return (
        <span
            className={cn(
                "flex items-center gap-1 text-sm font-medium",
                className ??
                    cn(
                        delta > 0 && "text-green-700",
                        delta < 0 && "text-danger-700",
                        delta === 0 && "text-ink-muted",
                    ),
            )}
        >
            <Icon aria-hidden="true" className="size-4" />
            {delta > 0 ? "+" : delta < 0 ? "−" : ""}
            {Math.abs(delta)}
            <span className="sr-only">
                {" "}
                points depuis le diagnostic précédent
            </span>
        </span>
    );
}

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * Progress circle with the score in the middle. Colours come from the
 * caller (white on the brand gradient, domain colour on a tinted panel).
 */
export function ScoreRing({
    score,
    label,
    className,
    trackClassName = "stroke-white/25",
    valueClassName = "stroke-white",
    unitClassName = "text-white/85",
}: {
    score: number;
    /** Accessible name, e.g. "Score global : 64 sur 100". */
    label: string;
    className?: string;
    trackClassName?: string;
    valueClassName?: string;
    unitClassName?: string;
}) {
    const clamped = Math.min(100, Math.max(0, score));
    return (
        <div
            role="img"
            aria-label={label}
            className={cn("relative size-40 shrink-0", className)}
        >
            <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                <circle
                    cx="50"
                    cy="50"
                    r={RING_RADIUS}
                    fill="none"
                    strokeWidth="8"
                    className={trackClassName}
                />
                <circle
                    cx="50"
                    cy="50"
                    r={RING_RADIUS}
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={RING_LENGTH}
                    strokeDashoffset={RING_LENGTH * (1 - clamped / 100)}
                    className={valueClassName}
                />
            </svg>
            <span
                aria-hidden="true"
                className="absolute inset-0 flex flex-col items-center justify-center"
            >
                <span className="text-5xl leading-none font-semibold">
                    {score}
                </span>
                <span className={cn("text-sm", unitClassName)}>/ 100</span>
            </span>
        </div>
    );
}
