import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mockDiagnosticHistory } from "@/lib/api/mocks";

import { DiagnosticHistory } from "./diagnostic-history";
import { RestartDiagnosticButton } from "./restart-diagnostic";

describe("DiagnosticHistory", () => {
    it("lists the diagnostics latest first, with their scores", () => {
        render(
            <DiagnosticHistory diagnostics={mockDiagnosticHistory} canEdit />,
        );

        const list = screen.getByRole("list", { name: "Diagnostics validés" });
        const items = within(list)
            .getAllByRole("listitem")
            .filter((item) => item.parentElement === list);
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent("Diagnostic du 12 oct. 2026");
        expect(items[0]).toHaveTextContent("Le plus récent");
        expect(items[0]).toHaveTextContent("Score global : 62 / 100");
        expect(items[0]).toHaveTextContent("Sécurité : 50");
        expect(items[1]).not.toHaveTextContent("Le plus récent");
        expect(items[1]).toHaveTextContent("Score global : 57 / 100");
    });

    it("links each diagnostic to its result and its PDF", () => {
        render(
            <DiagnosticHistory diagnostics={mockDiagnosticHistory} canEdit />,
        );

        expect(
            screen.getByRole("link", {
                name: "Voir le résultat du 1 juil. 2026",
            }),
        ).toHaveAttribute("href", "/diagnostic/historique/0");
        expect(
            screen.getByRole("link", {
                name: "Télécharger la synthèse du 12 oct. 2026 (PDF)",
            }),
        ).toHaveAttribute("href", "/diagnostic-files/1");
    });

    it("says what the history is for when it is empty", () => {
        const { unmount } = render(
            <DiagnosticHistory diagnostics={[]} canEdit />,
        );
        expect(
            screen.getByRole("heading", {
                name: "Aucun diagnostic validé pour l'instant",
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Faire le diagnostic" }),
        ).toHaveAttribute("href", "/diagnostic");
        unmount();

        render(<DiagnosticHistory diagnostics={[]} canEdit={false} />);
        expect(
            screen.queryByRole("link", { name: "Faire le diagnostic" }),
        ).not.toBeInTheDocument();
    });
});

describe("RestartDiagnosticButton", () => {
    it("asks for a confirmation before starting a new diagnostic", async () => {
        const restart = vi.fn().mockResolvedValue({ ok: true });
        render(<RestartDiagnosticButton diagnosticId="1" restart={restart} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Refaire un diagnostic" }),
        );
        const dialog = screen.getByRole("dialog", {
            name: "Refaire un diagnostic ?",
        });
        expect(dialog).toHaveTextContent("restent dans l'historique");
        expect(restart).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole("button", {
                name: "Commencer le nouveau diagnostic",
            }),
        );

        expect(restart).toHaveBeenCalledWith("1");
    });

    it("can be cancelled with the keyboard, the focus back on the button", async () => {
        const restart = vi.fn();
        render(<RestartDiagnosticButton diagnosticId="1" restart={restart} />);
        const button = screen.getByRole("button", {
            name: "Refaire un diagnostic",
        });

        await userEvent.click(button);
        await userEvent.keyboard("{Escape}");

        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
        expect(button).toHaveFocus();
        expect(restart).not.toHaveBeenCalled();
    });

    it("says why when the new diagnostic is refused", async () => {
        const restart = vi.fn().mockResolvedValue({
            error: "Un diagnostic est déjà en cours : reprenez-le avant d'en commencer un autre.",
        });
        render(<RestartDiagnosticButton diagnosticId="1" restart={restart} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Refaire un diagnostic" }),
        );
        await userEvent.click(
            screen.getByRole("button", {
                name: "Commencer le nouveau diagnostic",
            }),
        );

        expect(
            await screen.findByText(/Un diagnostic est déjà en cours/),
        ).toBeInTheDocument();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
});
