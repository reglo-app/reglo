import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/document-files/[id]/route";
import { POST } from "@/app/document-files/route";
import { mockCurrentUser, mockDocuments } from "@/lib/api/mocks";
import { getSessionToken } from "@/lib/auth/session";

import { deleteDocument } from "./actions";
import { decodeCsv, parseCsv } from "./csv";
import {
    canDeleteDocument,
    checkDocumentFile,
    DOCUMENT_MAX_BYTES,
    DOCUMENT_MESSAGES,
    formatFileSize,
    formatLabel,
} from "./documents";

vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`redirect:${url}`);
    }),
}));

beforeEach(() => {
    vi.mocked(getSessionToken).mockResolvedValue("session-token");
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe("checkDocumentFile", () => {
    it.each(["a.pdf", "a.PNG", "a.jpg", "a.jpeg", "a.xlsx", "a.csv"])(
        "accepts %s",
        (name) => {
            expect(checkDocumentFile({ name, size: 10 })).toBeNull();
        },
    );

    it.each(["a.docx", "a.exe", "a.pdf.php", "pdf", "a."])(
        "refuses %s",
        (name) => {
            expect(checkDocumentFile({ name, size: 10 })).toBe(
                DOCUMENT_MESSAGES.invalidType,
            );
        },
    );

    it("stops at exactly 20 MB, and refuses an empty file", () => {
        expect(
            checkDocumentFile({ name: "a.pdf", size: DOCUMENT_MAX_BYTES }),
        ).toBeNull();
        expect(
            checkDocumentFile({ name: "a.pdf", size: DOCUMENT_MAX_BYTES + 1 }),
        ).toBe(DOCUMENT_MESSAGES.tooLarge);
        expect(checkDocumentFile({ name: "a.pdf", size: 0 })).toBe(
            DOCUMENT_MESSAGES.empty,
        );
    });
});

describe("CSV preview", () => {
    it("reads the separator used in the file", () => {
        expect(parseCsv("a;b\n1;2\n").rows).toEqual([
            ["a", "b"],
            ["1", "2"],
        ]);
        expect(parseCsv("a,b\r\n1,2\r\n").rows).toEqual([
            ["a", "b"],
            ["1", "2"],
        ]);
    });

    it("keeps quoted values whole", () => {
        expect(
            parseCsv('nom;note\n"Dupont; Jean";"il dit ""oui""\net part"\n')
                .rows[1],
        ).toEqual(["Dupont; Jean", 'il dit "oui"\net part']);
    });

    it("ignores empty lines and accepts a last line without return", () => {
        expect(parseCsv("a;b\n\n1;2").rows).toEqual([
            ["a", "b"],
            ["1", "2"],
        ]);
    });

    it("stops after the maximum number of rows, and says so", () => {
        const text = "a\n".repeat(5);

        expect(parseCsv(text, 5)).toMatchObject({ truncated: false });
        const cut = parseCsv(text + "a\n", 5);
        expect(cut.rows).toHaveLength(5);
        expect(cut.truncated).toBe(true);
    });

    it("reads the accents of a file saved by Excel", () => {
        const utf8 = new TextEncoder().encode("contrôle").buffer as ArrayBuffer;
        const windows1252 = new Uint8Array([0x63, 0xf4, 0x74, 0xe9]).buffer;

        expect(decodeCsv(utf8)).toBe("contrôle");
        expect(decodeCsv(windows1252)).toBe("côté");
    });
});

describe("document labels and rights", () => {
    it("gives a size in French units", () => {
        expect(formatFileSize(830)).toBe("830 o");
        expect(formatFileSize(48_300)).toBe("47,2 ko");
        expect(formatFileSize(2_457_600)).toBe("2,3 Mo");
    });

    it("names the format found by the API", () => {
        expect(formatLabel("application/pdf")).toBe("PDF");
        expect(formatLabel("image/jpeg")).toBe("JPEG");
        expect(formatLabel("application/unknown")).toBe("Fichier");
    });

    it("lets the author or an administrator delete, never a reader", () => {
        const [byCamille, byHugo] = mockDocuments;
        const member = { ...mockCurrentUser, role: "member" as const };
        const reader = { ...mockCurrentUser, role: "reader" as const };

        expect(canDeleteDocument(byHugo, mockCurrentUser)).toBe(true);
        expect(canDeleteDocument(byCamille, member)).toBe(true);
        expect(canDeleteDocument(byHugo, member)).toBe(false);
        expect(canDeleteDocument(byCamille, reader)).toBe(false);
    });
});

describe("POST /document-files", () => {
    function upload(headers: Record<string, string> = {}) {
        return POST(
            new Request("http://web.test/document-files", {
                method: "POST",
                headers: {
                    "Content-Type": "multipart/form-data; boundary=x",
                    "Content-Length": "100",
                    ...headers,
                },
                body: "x".repeat(100),
            }),
        );
    }

    it("passes the file on as it arrives, with the session token", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(Response.json({ id: "7" }, { status: 201 }));
        vi.stubGlobal("fetch", fetchMock);

        const response = await upload();

        expect(response.status).toBe(201);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toMatch(/\/api\/documents$/);
        expect(init.headers).toMatchObject({
            Authorization: "Bearer session-token",
            "Content-Type": "multipart/form-data; boundary=x",
            "Content-Length": "100",
        });
        expect(init.body).toBeInstanceOf(ReadableStream);
    });

    it("refuses without a session, without calling the API", async () => {
        vi.mocked(getSessionToken).mockResolvedValue(null);
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        expect((await upload()).status).toBe(401);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses a body over the limit before reading it", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const response = await upload({
            "Content-Length": String(DOCUMENT_MAX_BYTES + 2 * 1024 * 1024),
        });

        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({ code: "too_large" });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("gives the messages of the API, never its technical answers", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    Response.json(
                        {
                            error: "Ce format n'est pas accepté.",
                            code: "invalid_type",
                        },
                        { status: 422 },
                    ),
                )
                .mockResolvedValueOnce(
                    new Response("Stack trace of the server", { status: 500 }),
                )
                .mockRejectedValueOnce(new TypeError("fetch failed")),
        );

        const refused = await upload();
        expect(refused.status).toBe(422);
        expect(await refused.json()).toEqual({
            error: "Ce format n'est pas accepté.",
            code: "invalid_type",
        });

        for (let i = 0; i < 2; i++) {
            const failed = await upload();
            expect(failed.status).toBe(503);
            expect((await failed.json()).error).toBe(
                DOCUMENT_MESSAGES.unavailable,
            );
        }
    });
});

describe("GET /document-files/{id}", () => {
    function download(id: string) {
        return GET(new Request(`http://web.test/document-files/${id}`), {
            params: Promise.resolve({ id }),
        });
    }

    it("streams the file as an attachment that cannot run", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response("%PDF", {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": 'attachment; filename="a.pdf"',
                },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const response = await download("7");

        expect(fetchMock.mock.calls[0][0]).toMatch(
            /\/api\/documents\/7\/download$/,
        );
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("%PDF");
        expect(response.headers.get("Content-Disposition")).toBe(
            'attachment; filename="a.pdf"',
        );
        expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("asks the API to show the file with ?view=1", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response("%PDF", {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": "inline",
                    "Content-Security-Policy": "default-src 'none'",
                },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const response = await GET(
            new Request("http://web.test/document-files/7?view=1"),
            { params: Promise.resolve({ id: "7" }) },
        );

        expect(fetchMock.mock.calls[0][0]).toMatch(
            /\/api\/documents\/7\/view$/,
        );
        expect(response.headers.get("Content-Disposition")).toBe("inline");
        expect(response.headers.get("Content-Security-Policy")).toBe(
            "default-src 'none'",
        );
        expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("answers 404 for a document of another organization", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
        );

        expect((await download("7")).status).toBe(404);
    });

    it("never calls the API with a malformed id", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        expect((await download("..%2F..%2Fusers")).status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("opens the login page without a session", async () => {
        vi.mocked(getSessionToken).mockResolvedValue(null);

        await expect(download("7")).rejects.toThrow(
            "redirect:/login?next=/documents",
        );
    });
});

describe("deleteDocument", () => {
    it("deletes, or says why it is refused", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(
                Response.json(
                    {
                        error: "Seuls l'auteur du justificatif et les administrateurs peuvent le supprimer.",
                        code: "delete_forbidden",
                    },
                    { status: 403 },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        expect(await deleteDocument("7")).toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/documents\/7$/),
            expect.objectContaining({ method: "DELETE" }),
        );
        expect(await deleteDocument("7")).toEqual({
            error: "Seuls l'auteur du justificatif et les administrateurs peuvent le supprimer.",
        });
    });
});
