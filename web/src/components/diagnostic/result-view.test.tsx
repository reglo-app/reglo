import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockDiagnosticResult, mockQuestionnaire } from "@/lib/api/mocks";

import { NoResult, ResultView } from "./result-view";

function renderResult(result = mockDiagnosticResult, canEdit = true) {
    return render(
        <ResultView
            result={result}
            questionnaire={mockQuestionnaire}
            canEdit={canEdit}
        />,
    );
}

describe("ResultView", () => {
    it("shows the rounded global score, its maturity and its trend", () => {
        renderResult();

        expect(
            screen.getByRole("img", { name: "Score global : 62 sur 100" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Maîtrisé")).toBeInTheDocument();
        expect(
            screen.getByText(/Diagnostic validé le 12 oct\. 2026/),
        ).toBeInTheDocument();
        const hero = screen
            .getByRole("heading", { name: "Score global" })
            .closest("[data-slot=card]") as HTMLElement;
        expect(hero).toHaveTextContent(
            "+5 points depuis le diagnostic précédent",
        );
    });

    it("gives each domain its score in words, not only a bar", () => {
        renderResult();

        const domains = screen
            .getByRole("heading", { name: "Score par domaine" })
            .closest("[data-slot=card]") as HTMLElement;
        const items = within(domains).getAllByRole("listitem");
        expect(items).toHaveLength(4);
        expect(items[0]).toHaveTextContent("Qualité");
        expect(items[0]).toHaveTextContent("72 / 100");
        expect(items[2]).toHaveTextContent("Sécurité");
        expect(items[2]).toHaveTextContent("50 / 100");
    });

    it("lists the questions that would raise the score the most", () => {
        renderResult();

        const gaps = screen
            .getByRole("heading", { name: "Actions prioritaires" })
            .closest("[data-slot=card]") as HTMLElement;
        const items = within(gaps).getAllByRole("listitem");
        expect(items[0]).toHaveTextContent("Sécurité");
        expect(items[0]).toHaveTextContent(/DUERP/);
        expect(items[0]).toHaveTextContent("+ 8,8 points possibles");
    });

    it("gives every score in a table", async () => {
        renderResult();

        await userEvent.click(
            screen.getByText("Voir tous les scores sous forme de tableau"),
        );

        const table = screen.getByRole("table", {
            name: "Scores du diagnostic du 12 oct. 2026",
        });
        expect(
            within(table).getByRole("row", { name: /Score global 62/ }),
        ).toBeInTheDocument();
        expect(
            within(table).getByRole("row", {
                name: /Qualité Pilotage et objectifs 72/,
            }),
        ).toBeInTheDocument();
    });

    it("says when a domain was not scored", () => {
        renderResult({
            ...mockDiagnosticResult,
            score: {
                ...mockDiagnosticResult.score,
                pillars: {
                    ...mockDiagnosticResult.score.pillars,
                    safety: null,
                },
            },
        });

        const domains = screen
            .getByRole("heading", { name: "Score par domaine" })
            .closest("[data-slot=card]") as HTMLElement;
        expect(within(domains).getAllByRole("listitem")[2]).toHaveTextContent(
            "Non concerné",
        );
    });

    it("says it is the first diagnostic when there is no previous one", () => {
        renderResult({ ...mockDiagnosticResult, previous: null });

        expect(screen.getAllByText("Premier diagnostic")).toHaveLength(5);
    });

    it("lets only members who can edit start a new diagnostic", () => {
        const { unmount } = renderResult();
        expect(
            screen.getByRole("link", { name: "Refaire un diagnostic" }),
        ).toHaveAttribute("href", "/diagnostic");
        unmount();

        renderResult(mockDiagnosticResult, false);
        expect(
            screen.queryByRole("link", { name: "Refaire un diagnostic" }),
        ).not.toBeInTheDocument();
    });
});

describe("NoResult", () => {
    it("invites to make the first diagnostic", () => {
        render(<NoResult canEdit />);

        expect(
            screen.getByRole("heading", { name: "Aucun score pour l'instant" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Faire le diagnostic" }),
        ).toHaveAttribute("href", "/diagnostic");
    });

    it("has no button for a reader", () => {
        render(<NoResult canEdit={false} />);

        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
});
