import { progressText } from "@/lib/trainings/filters";

/** "x / y leçons" as a bar, read as text by screen readers. */
export function TrainingProgress({
    done,
    total,
    label,
}: {
    done: number;
    total: number;
    /** Accessible name of the bar, e.g. the course title. */
    label: string;
}) {
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    return (
        <div className="flex flex-col gap-1.5">
            <div
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
                aria-valuetext={progressText(done, total)}
                className="h-1.5 overflow-hidden rounded-full bg-teal-50"
            >
                <div
                    className="h-full rounded-full bg-green-600 transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <p className="text-sm text-ink-muted">
                {done} / {total} leçon{total > 1 ? "s" : ""}
            </p>
        </div>
    );
}
