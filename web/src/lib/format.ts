// French date helpers for the UI. "today" is always passed in (from the API)
// so rendering stays deterministic on the server.

const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
});

/** "12 oct. 2026" */
export function formatDate(iso: string): string {
    return dateFormatter.format(new Date(iso));
}

/** Whole calendar days from `today` to `date` (negative when past). */
export function daysUntil(date: string, today: string): number {
    const start = Date.parse(today.slice(0, 10));
    const end = Date.parse(date.slice(0, 10));
    return Math.round((end - start) / DAY_MS);
}

function plural(count: number, word: string): string {
    return `${count} ${word}${count > 1 ? "s" : ""}`;
}

/** "En retard de 3 jours", "Aujourd'hui", "Demain", "Dans 12 jours". */
export function formatDueIn(date: string, today: string): string {
    const days = daysUntil(date, today);
    if (days < 0) return `En retard de ${plural(-days, "jour")}`;
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Demain";
    return `Dans ${plural(days, "jour")}`;
}
