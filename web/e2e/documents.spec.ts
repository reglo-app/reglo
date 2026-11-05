import { expect, test } from "@playwright/test";

// Pages use mock data here (see playwright.config.ts): the answer of the web
// server to the upload is simulated; the checks of the file are covered by
// the API tests.
const PDF = {
    name: "duerp-2026.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n"),
};

test("deposits a document", async ({ page }) => {
    await page.route("**/document-files", (route) =>
        route.fulfill({ status: 201, json: { id: "9" } }),
    );
    await page.goto("/documents");

    await page.getByLabel("Domaine (facultatif)").selectOption("safety");
    await page.getByLabel("Fichier à déposer").setInputFiles(PDF);

    await expect(
        page.getByText("« duerp-2026.pdf » est déposé."),
    ).toBeVisible();
    await expect(
        page.getByRole("alert").filter({ hasText: "format" }),
    ).toHaveCount(0);
});

test("refuses a format, and shows why the server refused a file", async ({
    page,
}) => {
    await page.route("**/document-files", (route) =>
        route.fulfill({
            status: 422,
            json: {
                error: "Ce format n'est pas accepté. Déposez un PDF, une image (PNG, JPEG) ou un tableur (XLSX, CSV).",
                code: "invalid_type",
            },
        }),
    );
    await page.goto("/documents");

    // Refused by its extension, nothing is sent.
    let sent = false;
    page.on("request", (request) => {
        if (request.url().endsWith("/document-files")) sent = true;
    });
    await page.getByLabel("Fichier à déposer").setInputFiles({
        name: "notes.docx",
        mimeType: "application/msword",
        buffer: Buffer.from("x"),
    });
    const refusal = page.getByRole("alert").filter({ hasText: "format" });
    await expect(refusal).toBeVisible();
    expect(sent).toBe(false);

    // Refused by its content: a false PDF.
    await page.getByLabel("Fichier à déposer").setInputFiles(PDF);
    await expect.poll(() => sent).toBe(true);
    await expect(refusal).toBeVisible();
    await expect(page.getByText("est déposé")).toHaveCount(0);
});

test("opens a document with a click on its name", async ({ page }) => {
    await page.goto("/documents");

    await page.getByRole("button", { name: "Voir DUERP-2026.pdf" }).click();
    const dialog = page.getByRole("dialog", { name: "DUERP-2026.pdf" });
    await expect(dialog.getByTitle("Aperçu de DUERP-2026.pdf")).toHaveAttribute(
        "src",
        "/document-files/1?view=1",
    );
    await expect(
        dialog.getByRole("link", { name: "Télécharger" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
});

test("shows a table in the page", async ({ page }) => {
    await page.route("**/document-files/4", (route) =>
        route.fulfill({
            contentType: "text/csv",
            body: "date;contrôle\n2026-09-15;extincteurs\n",
        }),
    );
    await page.goto("/documents");

    await page
        .getByRole("button", { name: "Voir Vérifications-extincteurs.csv" })
        .click();

    await expect(
        page.getByRole("columnheader", { name: "contrôle" }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "extincteurs" })).toBeVisible();
});

test("lists the documents with what identifies them", async ({ page }) => {
    await page.goto("/documents");

    const item = page
        .getByRole("listitem")
        .filter({ hasText: "DUERP-2026.pdf" });
    await expect(item).toContainText("PDF");
    await expect(item).toContainText("2,3 Mo");
    await expect(item).toContainText("Camille Martin");
    await expect(
        item.getByRole("link", { name: "Télécharger DUERP-2026.pdf" }),
    ).toHaveAttribute("href", "/document-files/1");
});
