/** Page title, short description and the single primary action (charter). */
export function PageHeader({
    title,
    description,
    action,
}: {
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
                {/* Uppercase through CSS only: screen readers keep the normal text. */}
                <h1 className="font-display text-xl font-extrabold tracking-wide text-ink uppercase sm:text-2xl">
                    {title}
                </h1>
                {description && <p className="text-ink-muted">{description}</p>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
