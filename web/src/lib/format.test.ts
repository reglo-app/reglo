import { describe, expect, it } from "vitest";

import { daysUntil, formatDate, formatDueIn } from "@/lib/format";

const TODAY = "2026-10-16T08:00:00.000Z";

describe("daysUntil", () => {
    it("counts calendar days, negative in the past", () => {
        expect(daysUntil("2026-10-20T00:00:00.000Z", TODAY)).toBe(4);
        expect(daysUntil("2026-10-10T00:00:00.000Z", TODAY)).toBe(-6);
        expect(daysUntil("2026-10-16T23:00:00.000Z", TODAY)).toBe(0);
    });
});

describe("formatDueIn", () => {
    it("writes a short French label", () => {
        expect(formatDueIn("2026-10-10T00:00:00.000Z", TODAY)).toBe(
            "En retard de 6 jours",
        );
        expect(formatDueIn("2026-10-15T00:00:00.000Z", TODAY)).toBe(
            "En retard de 1 jour",
        );
        expect(formatDueIn("2026-10-16T00:00:00.000Z", TODAY)).toBe(
            "Aujourd'hui",
        );
        expect(formatDueIn("2026-10-17T00:00:00.000Z", TODAY)).toBe("Demain");
        expect(formatDueIn("2026-10-28T00:00:00.000Z", TODAY)).toBe(
            "Dans 12 jours",
        );
    });
});

describe("formatDate", () => {
    it("uses the French short format", () => {
        expect(formatDate("2026-10-12T00:00:00.000Z")).toBe("12 oct. 2026");
    });
});
