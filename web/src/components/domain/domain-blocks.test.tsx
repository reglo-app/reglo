import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    DomainActionsCard,
    DomainScoreCard,
    ExpiringDocumentsCard,
} from "@/components/domain/domain-blocks";
import { mockDomainDetails } from "@/lib/api/mocks";

const safety = mockDomainDetails.safety;
const today = safety.generatedAt;

describe("DomainScoreCard", () => {
    it("shows the pillar score with its level and an accessible ring", () => {
        render(<DomainScoreCard detail={safety} />);
        expect(
            screen.getByRole("img", { name: "Score Sécurité : 49 sur 100" }),
        ).toBeInTheDocument();
        expect(screen.getByText("À renforcer")).toBeInTheDocument();
    });

    it("lists the themes weakest first and flags the weakest", () => {
        render(<DomainScoreCard detail={safety} />);
        const rows = within(
            screen.getByText("Score par thème").parentElement!,
        ).getAllByRole("listitem");
        expect(rows).toHaveLength(5);
        expect(rows[0]).toHaveTextContent("Évaluation des risques (DUERP)");
        expect(rows[0]).toHaveTextContent("Priorité");
        expect(rows[1]).not.toHaveTextContent("Priorité");
    });

    it("asks for the diagnostic when the pillar has no score", () => {
        render(<DomainScoreCard detail={{ ...safety, score: null }} />);
        expect(screen.getByRole("link", { name: "Commencer" })).toHaveAttribute(
            "href",
            "/diagnostic",
        );
    });
});

describe("DomainActionsCard", () => {
    it("shows only the pillar's actions with a due badge", () => {
        render(<DomainActionsCard actions={safety.actions} today={today} />);
        const items = screen.getAllByRole("listitem");
        expect(items[0]).toHaveTextContent("Mettre à jour le DUERP");
        expect(items[0]).toHaveTextContent("En retard de 6 jours");
        expect(safety.actions.every((a) => a.domain === "safety")).toBe(true);
    });

    it("has an empty state", () => {
        render(<DomainActionsCard actions={[]} today={today} />);
        expect(
            screen.getByText("Aucune action en cours sur ce domaine."),
        ).toBeInTheDocument();
    });
});

describe("ExpiringDocumentsCard", () => {
    it("lists documents with late ones first", () => {
        render(
            <ExpiringDocumentsCard
                documents={safety.expiringDocuments}
                today={today}
            />,
        );
        const items = screen.getAllByRole("listitem");
        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent("En retard de 4 jours");
        expect(screen.getByRole("link", { name: /Tout voir/ })).toHaveAttribute(
            "href",
            "/documents",
        );
    });

    it("has an empty state", () => {
        render(<ExpiringDocumentsCard documents={[]} today={today} />);
        expect(
            screen.getByText("Aucun justificatif à renouveler."),
        ).toBeInTheDocument();
    });
});
