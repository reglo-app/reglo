import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockDocumentAccesses, mockDocuments } from "@/lib/api/mocks";

import { AccessHistoryButton } from "./access-history";
import { DocumentFilters } from "./document-filters";
import { LinkedDocuments } from "./linked-documents";

const { replace, toastSuccess, toastError } = vi.hoisted(() => ({
    replace: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("sonner", () => ({
    toast: { success: toastSuccess, error: toastError },
}));

afterEach(() => {
    vi.clearAllMocks();
});

const [duerp, workbook, image] = mockDocuments;

function renderLinked(
    overrides: Partial<Parameters<typeof LinkedDocuments>[0]> = {},
) {
    const link = vi.fn().mockResolvedValue({ ok: true });
    const unlink = vi.fn().mockResolvedValue({ ok: true });
    render(
        <LinkedDocuments
            documents={[duerp]}
            available={mockDocuments}
            subject="cette action"
            canEdit
            link={link}
            unlink={unlink}
            {...overrides}
        />,
    );
    return { link, unlink };
}

describe("LinkedDocuments", () => {
    it("shows the linked documents with a way to download them", () => {
        renderLinked();

        expect(
            screen.getByRole("button", { name: "Voir DUERP-2026.pdf" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Télécharger DUERP-2026.pdf" }),
        ).toHaveAttribute("href", "/document-files/1");
    });

    it("says when nothing is linked yet", () => {
        renderLinked({ documents: [] });

        expect(
            screen.getByText("Aucun justificatif rattaché à cette action."),
        ).toBeInTheDocument();
    });

    it("lets a reader consult, without linking nor unlinking", () => {
        renderLinked({ canEdit: false });

        expect(
            screen.queryByRole("button", { name: /^Retirer/ }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Joindre un justificatif" }),
        ).not.toBeInTheDocument();
    });

    it("unlinks a document, which stays in the organization", async () => {
        const { unlink } = renderLinked();

        await userEvent.click(
            screen.getByRole("button", { name: "Retirer DUERP-2026.pdf" }),
        );

        expect(unlink).toHaveBeenCalledWith("1");
        await waitFor(() =>
            expect(toastSuccess).toHaveBeenCalledWith(
                "« DUERP-2026.pdf » n'est plus rattaché.",
            ),
        );
    });

    it("joins a document chosen among the ones not linked yet", async () => {
        const { link } = renderLinked();

        await userEvent.click(
            screen.getByRole("button", { name: "Joindre un justificatif" }),
        );
        const dialog = screen.getByRole("dialog", {
            name: "Joindre un justificatif",
        });
        // Already linked: not offered again.
        expect(
            within(dialog).queryByRole("button", {
                name: "Joindre DUERP-2026.pdf",
            }),
        ).not.toBeInTheDocument();
        await userEvent.type(
            within(dialog).getByLabelText("Rechercher par nom"),
            "REGISTRE",
        );
        expect(
            within(dialog).queryByRole("button", {
                name: `Joindre ${image.name}`,
            }),
        ).not.toBeInTheDocument();

        await userEvent.click(
            within(dialog).getByRole("button", {
                name: `Joindre ${workbook.name}`,
            }),
        );

        expect(link).toHaveBeenCalledWith("2");
        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
        expect(toastSuccess).toHaveBeenCalledWith(
            `« ${workbook.name} » est rattaché à cette action.`,
        );
    });

    it("keeps the dialog open and says why when the link is refused", async () => {
        renderLinked({
            link: vi.fn().mockResolvedValue({
                error: "Ce justificatif n'existe pas ou a été supprimé.",
            }),
        });

        await userEvent.click(
            screen.getByRole("button", { name: "Joindre un justificatif" }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: `Joindre ${image.name}` }),
        );

        await waitFor(() =>
            expect(toastError).toHaveBeenCalledWith(
                "Ce justificatif n'existe pas ou a été supprimé.",
            ),
        );
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
});

describe("AccessHistoryButton", () => {
    it("loads who opened the document when it opens", async () => {
        const load = vi
            .fn()
            .mockResolvedValue({ accesses: mockDocumentAccesses });
        render(
            <AccessHistoryButton
                documentId="1"
                name="DUERP-2026.pdf"
                load={load}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", {
                name: "Historique des accès à DUERP-2026.pdf",
            }),
        );

        expect(load).toHaveBeenCalledWith("1");
        const items = await screen.findAllByRole("listitem");
        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent("Hugo Bernard");
        expect(items[0]).toHaveTextContent("Téléchargé");
        expect(items[0]).toHaveTextContent("20 novembre 2026");
        expect(items[1]).toHaveTextContent("Consulté");
        expect(items[2]).toHaveTextContent("Ancien membre");
    });

    it("says when nobody opened it, or when the history is unavailable", async () => {
        const load = vi
            .fn()
            .mockResolvedValueOnce({ accesses: [] })
            .mockResolvedValueOnce({ error: "L'historique est indisponible." });
        render(
            <AccessHistoryButton
                documentId="1"
                name="DUERP-2026.pdf"
                load={load}
            />,
        );
        const button = screen.getByRole("button", {
            name: "Historique des accès à DUERP-2026.pdf",
        });

        await userEvent.click(button);
        expect(
            await screen.findByText("Personne ne l'a encore ouvert."),
        ).toBeInTheDocument();
        await userEvent.keyboard("{Escape}");

        await userEvent.click(button);
        expect(
            await screen.findByText("L'historique est indisponible."),
        ).toBeInTheDocument();
    });
});

describe("DocumentFilters", () => {
    const authors = [
        { id: "7", firstName: "Hugo", lastName: "Bernard", email: "h@test.fr" },
    ];

    beforeEach(() => replace.mockClear());

    it("gives every filter a label and the chosen values", () => {
        render(
            <DocumentFilters
                filters={{ q: "duerp", format: "pdf", author: "7" }}
                authors={authors}
                count={1}
            />,
        );

        expect(screen.getByLabelText("Nom")).toHaveValue("duerp");
        expect(screen.getByLabelText("Format")).toHaveValue("pdf");
        expect(screen.getByLabelText("Domaine")).toHaveValue("");
        expect(screen.getByLabelText("Déposé par")).toHaveValue("7");
        expect(screen.getByLabelText("Période")).toHaveValue("");
        expect(screen.getByLabelText("Trier par")).toHaveValue("recent");
        expect(screen.getByRole("status")).toHaveTextContent("1 justificatif");
    });

    it("puts a filter in the URL and keeps the others", async () => {
        render(
            <DocumentFilters
                filters={{ format: "pdf" }}
                authors={authors}
                count={2}
            />,
        );

        await userEvent.selectOptions(screen.getByLabelText("Période"), "30d");

        expect(replace).toHaveBeenCalledWith(
            "/documents?format=pdf&period=30d",
            { scroll: false },
        );
    });

    it("searches once typing pauses", async () => {
        render(<DocumentFilters filters={{}} authors={authors} count={4} />);
        const field = screen.getByLabelText("Nom");

        await userEvent.type(field, "duerp");
        // Not at each letter.
        expect(replace).not.toHaveBeenCalled();

        await waitFor(() =>
            expect(replace).toHaveBeenCalledWith("/documents?q=duerp", {
                scroll: false,
            }),
        );
        expect(replace).toHaveBeenCalledTimes(1);
        expect(field).toHaveFocus();
    });

    it("clears the filters but keeps the sort and the focus", async () => {
        render(
            <DocumentFilters
                filters={{ q: "duerp", domain: "safety", sort: "name" }}
                authors={authors}
                count={0}
            />,
        );
        expect(screen.getByRole("status")).toHaveTextContent(
            "Aucun justificatif",
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Effacer les filtres" }),
        );

        expect(replace).toHaveBeenCalledWith("/documents?sort=name", {
            scroll: false,
        });
        expect(screen.getByLabelText("Nom")).toHaveValue("");
        expect(screen.getByLabelText("Nom")).toHaveFocus();
    });
});
