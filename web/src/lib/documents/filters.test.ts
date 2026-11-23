import { describe, expect, it } from "vitest";

import { mockDocuments } from "@/lib/api/mocks";

import {
    documentFiltersQuery,
    filterDocuments,
    hasDocumentFilters,
    parseDocumentFilters,
} from "./filters";

describe("parseDocumentFilters", () => {
    it("keeps the known values and drops the others", () => {
        expect(
            parseDocumentFilters(
                {
                    q: "  duerp ",
                    format: "pdf",
                    domain: "finance",
                    author: "7",
                    period: "week",
                    sort: "name",
                },
                ["7", "8"],
            ),
        ).toEqual({ q: "duerp", format: "pdf", author: "7", sort: "name" });
        // Not a member of the organization: ignored.
        expect(parseDocumentFilters({ author: "99" }, ["7"])).toEqual({});
    });

    it("cuts a search longer than the API accepts", () => {
        const filters = parseDocumentFilters({ q: "a".repeat(150) }, []);

        expect(filters.q).toHaveLength(100);
    });
});

describe("documentFiltersQuery", () => {
    it("writes only the filters given", () => {
        expect(documentFiltersQuery({})).toBe("");
        expect(
            documentFiltersQuery({ q: "plan d'actions", format: "pdf" }),
        ).toBe("?q=plan+d%27actions&format=pdf");
    });
});

describe("hasDocumentFilters", () => {
    it("does not count the sort as a filter", () => {
        expect(hasDocumentFilters({ sort: "name" })).toBe(false);
        expect(hasDocumentFilters({ period: "30d" })).toBe(true);
    });
});

describe("filterDocuments", () => {
    const names = (filters: Parameters<typeof filterDocuments>[1]) =>
        filterDocuments(
            mockDocuments,
            filters,
            new Date("2026-10-20T06:00:00Z"),
        ).map((document) => document.name);

    it("searches the name whatever the case", () => {
        expect(names({ q: "duerp" })).toEqual(["DUERP-2026.pdf"]);
    });

    it("filters by format, domain, author and period", () => {
        expect(names({ format: "spreadsheet" })).toEqual([
            "Registre des contrôles.xlsx",
            "Vérifications-extincteurs.csv",
        ]);
        expect(names({ domain: "safety", format: "pdf" })).toEqual([
            "DUERP-2026.pdf",
        ]);
        expect(names({ author: mockDocuments[1].uploadedBy?.id })).toEqual([
            "Registre des contrôles.xlsx",
            "Vérifications-extincteurs.csv",
        ]);
        expect(names({ period: "30d" })).toEqual([
            "DUERP-2026.pdf",
            "Registre des contrôles.xlsx",
            "Certificat-tri-dechets.jpg",
        ]);
    });

    it("sorts by date or by name", () => {
        expect(names({ sort: "oldest" })[0]).toBe(
            "Vérifications-extincteurs.csv",
        );
        expect(names({ sort: "name" })).toEqual([
            "Certificat-tri-dechets.jpg",
            "DUERP-2026.pdf",
            "Registre des contrôles.xlsx",
            "Vérifications-extincteurs.csv",
        ]);
    });
});
