import { describe, expect, it } from "vitest";

import {
    HOME_ITEM,
    NAV_ITEMS,
    NAV_SECTIONS,
    findNavEntry,
    findNavItem,
    getBreadcrumb,
    isActive,
} from "@/lib/navigation";

describe("isActive", () => {
    it("matches the page and its sub-pages only", () => {
        const item = { href: "/actions" };
        expect(isActive(item, "/actions")).toBe(true);
        expect(isActive(item, "/actions/42")).toBe(true);
        expect(isActive(item, "/actions-archive")).toBe(false);
    });
});

describe("navigation tree", () => {
    it("puts Diagnostic, Plan d'actions and Veille under Tableau de bord", () => {
        expect(HOME_ITEM.children?.map((c) => c.label)).toEqual([
            "Diagnostic",
            "Plan d'actions",
            "Veille réglementaire",
        ]);
        const topLevel = NAV_ITEMS.map((item) => item.label);
        expect(topLevel).not.toContain("Diagnostic");
        expect(topLevel).not.toContain("Plan d'actions");
        expect(topLevel).not.toContain("Veille réglementaire");
    });

    it("groups the four pillars in a titled section", () => {
        const pillars = NAV_SECTIONS.find((s) => s.title === "Domaines QHSE");
        expect(pillars?.items.map((item) => item.domain)).toEqual([
            "quality",
            "hygiene",
            "safety",
            "environment",
        ]);
    });

    it("maps a sub-page to its parent branch", () => {
        const entry = findNavEntry("/diagnostic");
        expect(entry?.isChild).toBe(true);
        expect(entry?.item).toBe(HOME_ITEM);
        expect(findNavItem("/diagnostic")).toBe(HOME_ITEM);
    });

    it("maps a domain page to its pillar", () => {
        expect(findNavItem("/domains/safety")?.label).toBe("Sécurité");
        expect(findNavItem("/dashboard")?.label).toBe("Tableau de bord");
    });
});

describe("getBreadcrumb", () => {
    it("has only the home crumb on the dashboard", () => {
        expect(getBreadcrumb("/dashboard").map((c) => c.label)).toEqual([
            "Tableau de bord",
        ]);
    });

    it("starts at the section for pages outside Tableau de bord", () => {
        const crumbs = getBreadcrumb("/documents");
        expect(crumbs.map((c) => c.label)).toEqual(["Justificatifs"]);
        expect(crumbs[0].icon).toBeDefined();
    });

    it("shows a sub-page of the home branch after the home crumb", () => {
        expect(getBreadcrumb("/diagnostic").map((c) => c.label)).toEqual([
            "Tableau de bord",
            "Diagnostic",
        ]);
        expect(getBreadcrumb("/news").map((c) => c.label)).toEqual([
            "Tableau de bord",
            "Veille réglementaire",
        ]);
    });

    it("shows only the pillar on a domain page", () => {
        expect(getBreadcrumb("/domains/hygiene").map((c) => c.label)).toEqual([
            "Hygiène-Santé",
        ]);
    });

    it("names an article page instead of showing its id", () => {
        expect(getBreadcrumb("/news/news-1").map((c) => c.label)).toEqual([
            "Tableau de bord",
            "Veille réglementaire",
            "Article",
        ]);
    });

    it("adds a detail crumb for a sub-page", () => {
        expect(getBreadcrumb("/actions/42").map((c) => c.href)).toEqual([
            "/dashboard",
            "/actions",
            "/actions/42",
        ]);
    });

    it("falls back to the home crumb for an unknown path", () => {
        expect(getBreadcrumb("/unknown")).toHaveLength(1);
    });
});
