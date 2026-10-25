import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppBreadcrumb } from "@/components/shell/app-breadcrumb";
import { AppShell } from "@/components/shell/app-shell";
import { SidebarNav } from "@/components/shell/sidebar-nav";

const pathname = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
    usePathname: () => pathname.current,
}));

beforeEach(() => {
    pathname.current = "/dashboard";
    localStorage.clear();
});

describe("SidebarNav", () => {
    it("marks only the current section as the current page", () => {
        pathname.current = "/actions/42";
        render(<SidebarNav />);
        const nav = screen.getByRole("navigation", {
            name: "Navigation principale",
        });
        expect(
            within(nav).getByRole("link", { name: "Plan d'actions" }),
        ).toHaveAttribute("aria-current", "page");
        expect(
            within(nav).getByRole("link", { name: "Tableau de bord" }),
        ).not.toHaveAttribute("aria-current");
    });

    it("lists the four QHSE domains and highlights the current one", () => {
        pathname.current = "/domains/environment";
        render(<SidebarNav />);
        const nav = screen.getByRole("navigation", {
            name: "Navigation principale",
        });
        for (const label of [
            "Qualité",
            "Hygiène-Santé",
            "Sécurité",
            "Environnement",
        ]) {
            expect(
                within(nav).getByRole("link", { name: label }),
            ).toBeInTheDocument();
        }
        expect(
            within(nav).getByRole("link", { name: "Environnement" }),
        ).toHaveAttribute("aria-current", "page");
        expect(
            within(nav).getByRole("link", { name: "Tableau de bord" }),
        ).not.toHaveAttribute("aria-current");
    });

    it("keeps accessible labels when collapsed", () => {
        render(<SidebarNav collapsed />);
        expect(
            screen.getByRole("link", { name: "Formations" }),
        ).toBeInTheDocument();
    });

    it("titles only the QHSE pillars section", () => {
        render(<SidebarNav />);
        expect(screen.getByText("Domaines QHSE")).toBeInTheDocument();
        for (const title of ["Pilotage", "Ressources"]) {
            expect(screen.queryByText(title)).not.toBeInTheDocument();
        }
    });

    it("shows Diagnostic only inside the Tableau de bord branch", () => {
        pathname.current = "/documents";
        const { unmount } = render(<SidebarNav />);
        expect(
            screen.queryByRole("link", { name: "Diagnostic" }),
        ).not.toBeInTheDocument();
        unmount();

        pathname.current = "/dashboard";
        render(<SidebarNav />);
        expect(
            screen.getByRole("link", { name: "Diagnostic" }),
        ).toBeInTheDocument();
    });

    it("on Diagnostic, marks the child as current and emphasises the parent", () => {
        pathname.current = "/diagnostic";
        render(<SidebarNav />);
        const child = screen.getByRole("link", { name: "Diagnostic" });
        const parent = screen.getByRole("link", { name: "Tableau de bord" });
        expect(child).toHaveAttribute("aria-current", "page");
        expect(child.querySelector("svg")).toBeNull();
        expect(parent).not.toHaveAttribute("aria-current");
        expect(parent).toHaveClass("font-semibold");
    });

    it("hides sub-pages when collapsed but keeps the parent filled", () => {
        pathname.current = "/diagnostic";
        render(<SidebarNav collapsed />);
        expect(
            screen.queryByRole("link", { name: "Diagnostic" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Tableau de bord" }),
        ).toHaveClass("bg-green-50");
    });
});

describe("AppBreadcrumb", () => {
    it("links to the home page and marks the section as current", () => {
        pathname.current = "/diagnostic";
        render(<AppBreadcrumb />);
        const breadcrumb = screen.getByRole("navigation", {
            name: "Fil d'Ariane",
        });
        expect(
            within(breadcrumb).getByRole("link", { name: "Tableau de bord" }),
        ).toHaveAttribute("href", "/dashboard");
        expect(
            within(breadcrumb).getByText("Diagnostic").parentElement,
        ).toHaveAttribute("aria-current", "page");
    });
});

describe("AppShell", () => {
    it("collapses the desktop sidebar and remembers it", async () => {
        const u = userEvent.setup();
        render(<AppShell userMenu={null}>Contenu</AppShell>);
        const toggle = screen.getByRole("button", { name: "Replier le menu" });
        expect(toggle).toHaveAttribute("aria-expanded", "true");

        await u.click(toggle);

        expect(
            screen.getByRole("button", { name: "Déplier le menu" }),
        ).toHaveAttribute("aria-expanded", "false");
        expect(localStorage.getItem("reglo.sidebar.collapsed")).toBe("true");
    });

    it("opens the mobile menu as a dialog", async () => {
        const u = userEvent.setup();
        render(<AppShell userMenu={null}>Contenu</AppShell>);
        await u.click(screen.getByRole("button", { name: "Ouvrir le menu" }));
        expect(
            screen.getByRole("dialog", { name: "Menu" }),
        ).toBeInTheDocument();
    });

    it("offers a skip link to the main content", () => {
        render(<AppShell userMenu={null}>Contenu</AppShell>);
        expect(
            screen.getByRole("link", { name: "Aller au contenu" }),
        ).toHaveAttribute("href", "#main-content");
        expect(screen.getByRole("main")).toHaveTextContent("Contenu");
    });
});
