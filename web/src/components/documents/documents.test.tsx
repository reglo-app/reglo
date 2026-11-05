import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockCurrentUser, mockDocuments } from "@/lib/api/mocks";
import type { EvidenceDocument } from "@/lib/api/types";
import {
    CSV_PREVIEW_MAX_BYTES,
    DOCUMENT_MAX_BYTES,
} from "@/lib/documents/documents";

import { DeleteDocumentButton } from "./delete-document-button";
import { DocumentList } from "./document-list";
import { DocumentUploader } from "./document-uploader";
import { DocumentViewer } from "./document-viewer";

const { routerRefresh, routerPush, toastSuccess } = vi.hoisted(() => ({
    routerRefresh: vi.fn(),
    routerPush: vi.fn(),
    toastSuccess: vi.fn(),
}));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: routerRefresh, push: routerPush }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

afterEach(() => {
    vi.clearAllMocks();
});

function pdf(name = "duerp.pdf", size = 10) {
    const file = new File(["x"], name);
    Object.defineProperty(file, "size", { value: size });
    return file;
}

function choose(file: File) {
    return userEvent.upload(screen.getByLabelText("Fichier à déposer"), file, {
        // Drag and drop skips the filter of the file picker: so does this.
        applyAccept: false,
    });
}

describe("DocumentUploader", () => {
    it("sends the file with its domain, then refreshes the list", async () => {
        const upload = vi.fn().mockResolvedValue({ ok: true });
        render(<DocumentUploader upload={upload} />);

        await userEvent.selectOptions(
            screen.getByLabelText("Domaine (facultatif)"),
            "safety",
        );
        const file = pdf();
        await userEvent.upload(
            screen.getByLabelText("Fichier à déposer"),
            file,
        );

        expect(upload).toHaveBeenCalledWith(
            file,
            "safety",
            expect.any(Function),
        );
        await waitFor(() =>
            expect(toastSuccess).toHaveBeenCalledWith(
                "« duerp.pdf » est déposé.",
            ),
        );
        expect(routerRefresh).toHaveBeenCalled();
    });

    it("opens the file picker with the keyboard", async () => {
        render(<DocumentUploader upload={vi.fn()} />);
        const input =
            screen.getByLabelText<HTMLInputElement>("Fichier à déposer");
        const click = vi.spyOn(input, "click");

        screen.getByRole("button", { name: "Choisir un fichier" }).focus();
        await userEvent.keyboard("{Enter}");

        expect(click).toHaveBeenCalled();
    });

    it("shows the progress while the file is sent", async () => {
        let progress: (percent: number) => void = () => {};
        let finish: (result: { ok: true }) => void = () => {};
        const upload = vi.fn((_file, _domain, onProgress) => {
            progress = onProgress;
            return new Promise<{ ok: true }>((resolve) => {
                finish = resolve;
            });
        });
        render(<DocumentUploader upload={upload} />);

        await choose(pdf());
        const { act } = await import("react");
        act(() => progress(40));

        expect(
            screen.getByRole("progressbar", { name: "Dépôt de duerp.pdf" }),
        ).toHaveAttribute("aria-valuenow", "40");
        expect(screen.getByText("40 %")).toBeInTheDocument();
        expect(screen.getByLabelText("Domaine (facultatif)")).toBeDisabled();

        await act(async () => finish({ ok: true }));
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it.each([
        ["notes.docx", 10, "Ce format n'est pas accepté"],
        ["gros.pdf", DOCUMENT_MAX_BYTES + 1, "20 Mo"],
        ["vide.pdf", 0, "Ce fichier est vide"],
    ])("refuses %s before sending anything", async (name, size, message) => {
        const upload = vi.fn();
        render(<DocumentUploader upload={upload} />);

        await choose(pdf(name, size));

        expect(screen.getByRole("alert")).toHaveTextContent(message);
        expect(upload).not.toHaveBeenCalled();
    });

    it("gives the reason of a refusal or a failure, then lets try again", async () => {
        const upload = vi
            .fn()
            .mockResolvedValueOnce({ error: "La connexion a été interrompue." })
            .mockResolvedValueOnce({ ok: true });
        render(<DocumentUploader upload={upload} />);

        await choose(pdf());
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "La connexion a été interrompue.",
        );
        expect(routerRefresh).not.toHaveBeenCalled();

        await choose(pdf());
        await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("leaves when the session has expired", async () => {
        const upload = vi.fn().mockResolvedValue({
            error: "Votre session a expiré.",
            sessionExpired: true,
        });
        render(<DocumentUploader upload={upload} />);

        await choose(pdf());

        await waitFor(() =>
            expect(routerPush).toHaveBeenCalledWith("/session-expired"),
        );
    });

    it("accepts a file dropped on the zone", async () => {
        const upload = vi.fn().mockResolvedValue({ ok: true });
        render(<DocumentUploader upload={upload} />);
        const file = pdf();

        fireEvent.drop(screen.getByTestId("document-dropzone"), {
            dataTransfer: { files: [file] },
        });

        expect(upload).toHaveBeenCalledWith(file, "", expect.any(Function));
        expect(
            await screen.findByText("Choisir un fichier"),
        ).toBeInTheDocument();
    });
});

describe("DocumentList", () => {
    it("gives the name, type, size, date and author of each document", () => {
        render(
            <DocumentList documents={mockDocuments} user={mockCurrentUser} />,
        );

        const items = screen.getAllByRole("listitem");
        expect(items).toHaveLength(4);
        expect(items[0]).toHaveTextContent("DUERP-2026.pdf");
        expect(items[0]).toHaveTextContent("PDF");
        expect(items[0]).toHaveTextContent("Sécurité");
        expect(items[0]).toHaveTextContent("2,3 Mo");
        expect(items[0]).toHaveTextContent("12 oct. 2026");
        expect(items[0]).toHaveTextContent("Camille Martin");
        expect(items[2]).toHaveTextContent("Ancien membre");
    });

    it("downloads through the web server, never from a public address", () => {
        render(
            <DocumentList documents={mockDocuments} user={mockCurrentUser} />,
        );

        expect(
            screen.getByRole("link", { name: "Télécharger DUERP-2026.pdf" }),
        ).toHaveAttribute("href", "/document-files/1");
    });

    it("offers to delete only what the user may delete", () => {
        const member = { ...mockCurrentUser, role: "member" as const };
        const { unmount } = render(
            <DocumentList documents={mockDocuments} user={member} />,
        );
        expect(
            screen.getAllByRole("button", { name: /^Supprimer/ }),
        ).toHaveLength(1);
        expect(
            screen.getByRole("button", { name: "Supprimer DUERP-2026.pdf" }),
        ).toBeInTheDocument();
        unmount();

        render(
            <DocumentList
                documents={mockDocuments}
                user={{ ...mockCurrentUser, role: "reader" }}
            />,
        );
        expect(
            screen.queryByRole("button", { name: /^Supprimer/ }),
        ).not.toBeInTheDocument();
        expect(screen.getAllByRole("link")).toHaveLength(4);
    });

    it("says what to put here when there is nothing", () => {
        render(<DocumentList documents={[]} user={mockCurrentUser} />);

        expect(
            screen.getByRole("heading", {
                name: "Aucun justificatif pour l'instant",
            }),
        ).toBeInTheDocument();
    });
});

describe("DocumentViewer", () => {
    const [pdfDocument, workbook, image, table] = mockDocuments;

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    async function open(document: EvidenceDocument) {
        render(<DocumentViewer document={document} />);
        await userEvent.click(
            screen.getByRole("button", { name: `Voir ${document.name}` }),
        );
        return screen.getByRole("dialog", { name: document.name });
    }

    it("loads nothing before the click", () => {
        render(<DocumentViewer document={pdfDocument} />);

        expect(screen.queryByTitle(/Aperçu/)).not.toBeInTheDocument();
    });

    it("shows a PDF, with other ways to open it", async () => {
        const dialog = await open(pdfDocument);

        expect(
            within(dialog).getByTitle("Aperçu de DUERP-2026.pdf"),
        ).toHaveAttribute("src", "/document-files/1?view=1");
        expect(dialog).toHaveTextContent("PDF, 2,3 Mo");
        expect(
            within(dialog).getByRole("link", { name: /Nouvel onglet/ }),
        ).toHaveAttribute("href", "/document-files/1?view=1");
        expect(
            within(dialog).getByRole("link", { name: "Télécharger" }),
        ).toHaveAttribute("href", "/document-files/1");
    });

    it("shows an image with a text alternative", async () => {
        const dialog = await open(image);

        expect(
            within(dialog).getByRole("img", {
                name: "Aperçu de Certificat-tri-dechets.jpg",
            }),
        ).toHaveAttribute("src", "/document-files/3?view=1");
    });

    it("says that a workbook can only be downloaded", async () => {
        const dialog = await open(workbook);

        expect(dialog).toHaveTextContent("Ce format ne peut pas être affiché");
        expect(
            within(dialog).queryByRole("link", { name: /Nouvel onglet/ }),
        ).not.toBeInTheDocument();
        expect(
            within(dialog).getByRole("link", { name: "Télécharger" }),
        ).toBeInTheDocument();
    });

    it("shows a table, its values only as text", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValue(
                    new Response(
                        "date;contrôle\n2026-11-05;<img src=x onerror=alert(1)>\n",
                    ),
                ),
        );

        const dialog = await open(table);

        expect(
            await within(dialog).findByRole("columnheader", {
                name: "contrôle",
            }),
        ).toBeInTheDocument();
        expect(
            within(dialog).getByRole("cell", {
                name: "<img src=x onerror=alert(1)>",
            }),
        ).toBeInTheDocument();
        expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
        expect(fetch).toHaveBeenCalledWith(
            "/document-files/4",
            expect.anything(),
        );
    });

    it("says when a table cannot be loaded", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
        );

        const dialog = await open(table);

        expect(
            await within(dialog).findByText(/n'a pas pu être chargé/),
        ).toBeInTheDocument();
    });

    it("does not read a very large table in the browser", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const dialog = await open({
            ...table,
            size: CSV_PREVIEW_MAX_BYTES + 1,
        });

        expect(dialog).toHaveTextContent("trop volumineux");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("DeleteDocumentButton", () => {
    it("deletes only once confirmed, and shows a refusal", async () => {
        const remove = vi
            .fn()
            .mockResolvedValueOnce({ error: "Suppression refusée." })
            .mockResolvedValueOnce({ ok: true });
        render(
            <DeleteDocumentButton
                documentId="3"
                name="duerp.pdf"
                remove={remove}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Supprimer duerp.pdf" }),
        );
        const dialog = screen.getByRole("dialog", {
            name: "Supprimer ce justificatif ?",
        });
        expect(remove).not.toHaveBeenCalled();

        const confirm = within(dialog).getByRole("button", {
            name: "Supprimer le justificatif",
        });
        await userEvent.click(confirm);
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "Suppression refusée.",
        );

        await userEvent.click(confirm);
        expect(remove).toHaveBeenLastCalledWith("3");
        await waitFor(() =>
            expect(toastSuccess).toHaveBeenCalledWith(
                "« duerp.pdf » est supprimé.",
            ),
        );
        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
    });
});
