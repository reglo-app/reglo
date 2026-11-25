import { describe, expect, it } from "vitest";

import { mockTrainings } from "@/lib/api/mocks";

import {
    filterTrainings,
    formatDuration,
    parseTrainingFilters,
    progressText,
    trainingFiltersQuery,
} from "./filters";

describe("parseTrainingFilters", () => {
    it("keeps the known filters of the URL", () => {
        expect(
            parseTrainingFilters({ domain: "safety", access: "free" }),
        ).toEqual({ domain: "safety", access: "free" });
    });

    it("ignores hand-written values that do not exist", () => {
        expect(
            parseTrainingFilters({ domain: "rse", access: ["free", "paid"] }),
        ).toEqual({});
    });
});

describe("trainingFiltersQuery", () => {
    it("builds the query of the API and of the page", () => {
        expect(
            trainingFiltersQuery({ domain: "quality", access: "paid" }),
        ).toBe("?domain=quality&access=paid");
        expect(trainingFiltersQuery({})).toBe("");
    });
});

describe("filterTrainings", () => {
    it("filters the mock catalog like the API", () => {
        const ids = (filters: Parameters<typeof filterTrainings>[1]) =>
            filterTrainings(mockTrainings, filters).map((t) => t.id);

        expect(ids({ access: "paid" })).toEqual(["hygiene-haccp"]);
        expect(ids({ access: "free", domain: "quality" })).toEqual([
            "bases-iso-9001",
        ]);
        expect(ids({ domain: "environment" })).toEqual([]);
        expect(ids({})).toHaveLength(mockTrainings.length);
    });
});

describe("formatDuration", () => {
    it("writes minutes, then hours", () => {
        expect(formatDuration(45)).toBe("45 min");
        expect(formatDuration(60)).toBe("1 h");
        expect(formatDuration(95)).toBe("1 h 35");
        expect(formatDuration(125)).toBe("2 h 05");
    });
});

describe("progressText", () => {
    it("agrees with the number of lessons done", () => {
        expect(progressText(0, 3)).toBe("0 leçon terminée sur 3");
        expect(progressText(1, 3)).toBe("1 leçon terminée sur 3");
        expect(progressText(2, 3)).toBe("2 leçons terminées sur 3");
    });
});
