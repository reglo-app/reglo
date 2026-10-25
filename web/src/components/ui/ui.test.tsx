import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DomainBadge } from "@/components/domain-badge";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

describe("Button", () => {
    it("uses the brand gradient and a 40px height by default", () => {
        render(<Button>Enregistrer</Button>);
        const button = screen.getByRole("button", { name: "Enregistrer" });
        expect(button).toHaveClass("bg-brand-gradient", "text-white", "h-10");
    });

    it("renders the highlight variant with teal text on yellow", () => {
        render(<Button variant="highlight">Commencer</Button>);
        expect(screen.getByRole("button")).toHaveClass(
            "bg-brand-yellow",
            "text-brand-teal",
        );
    });

    it("lets a caller class win over the variant class", () => {
        render(<Button className="h-12">Grand</Button>);
        const button = screen.getByRole("button");
        expect(button).toHaveClass("h-12");
        expect(button).not.toHaveClass("h-10");
    });
});

describe("Input", () => {
    it("is labelled and uses the strong border", () => {
        render(
            <>
                <label htmlFor="email">Adresse e-mail</label>
                <Input id="email" />
            </>,
        );
        expect(screen.getByLabelText("Adresse e-mail")).toHaveClass(
            "border-border-strong",
            "h-10",
        );
    });
});

describe("DomainBadge", () => {
    it("always shows the domain name, not only its colour", () => {
        render(<DomainBadge domain="hygiene" />);
        expect(screen.getByText("Hygiène-Santé")).toHaveAttribute(
            "data-variant",
            "hygiene",
        );
    });
});

describe("Alert", () => {
    it("is announced to assistive technologies", () => {
        render(
            <Alert variant="destructive">
                <AlertTitle>Une erreur est survenue</AlertTitle>
            </Alert>,
        );
        expect(screen.getByRole("alert")).toHaveTextContent(
            "Une erreur est survenue",
        );
    });
});

describe("Breadcrumb", () => {
    it("marks the last item as the current page", () => {
        render(
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">
                            Tableau de bord
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Diagnostic</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>,
        );
        expect(
            screen.getByRole("navigation", { name: "Fil d'Ariane" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Diagnostic")).toHaveAttribute(
            "aria-current",
            "page",
        );
        expect(
            screen.getByRole("link", { name: "Tableau de bord" }),
        ).toHaveAttribute("href", "/dashboard");
    });
});

describe("Tabs", () => {
    it("switches panel with the keyboard", async () => {
        const user = userEvent.setup();
        render(
            <Tabs defaultValue="a">
                <TabsList>
                    <TabsTrigger value="a">Premier</TabsTrigger>
                    <TabsTrigger value="b">Second</TabsTrigger>
                </TabsList>
                <TabsContent value="a">Panneau A</TabsContent>
                <TabsContent value="b">Panneau B</TabsContent>
            </Tabs>,
        );
        await user.click(screen.getByRole("tab", { name: "Premier" }));
        await user.keyboard("{ArrowRight}");
        expect(screen.getByRole("tab", { name: "Second" })).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(screen.getByRole("tabpanel")).toHaveTextContent("Panneau B");
    });
});

describe("Dialog", () => {
    it("opens and closes with the French close button", async () => {
        const user = userEvent.setup();
        render(
            <Dialog>
                <DialogTrigger>Ouvrir</DialogTrigger>
                <DialogContent>
                    <DialogTitle>Supprimer cette action ?</DialogTitle>
                    <DialogDescription>Action définitive.</DialogDescription>
                </DialogContent>
            </Dialog>,
        );
        await user.click(screen.getByRole("button", { name: "Ouvrir" }));
        expect(screen.getByRole("dialog")).toHaveAccessibleName(
            "Supprimer cette action ?",
        );
        await user.click(screen.getByRole("button", { name: "Fermer" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
