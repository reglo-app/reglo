import { expect, test } from "@playwright/test";

test("opens a QHSE domain page from the sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.getByRole("navigation", {
        name: "Navigation principale",
    });

    await sidebar.getByRole("link", { name: "Sécurité" }).click();

    await expect(page).toHaveURL(/\/domains\/safety$/);
    await expect(
        page.getByRole("heading", { level: 1, name: "Sécurité" }),
    ).toBeVisible();
    await expect(
        sidebar.getByRole("link", { name: "Sécurité" }),
    ).toHaveAttribute("aria-current", "page");
    // A pillar is not under Tableau de bord: the breadcrumb is just "Sécurité".
    await expect(
        page
            .getByRole("navigation", { name: "Fil d'Ariane" })
            .getByRole("link", { name: "Tableau de bord" }),
    ).toHaveCount(0);
});

test("shows a French not found page for an unknown domain", async ({
    page,
}) => {
    await page.goto("/domains/finance");
    await expect(
        page.getByRole("heading", { level: 1, name: "Page introuvable" }),
    ).toBeVisible();
});

test("shows a French not found page for an unknown url", async ({ page }) => {
    const response = await page.goto("/does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(
        page.getByRole("heading", { level: 1, name: "Page introuvable" }),
    ).toBeVisible();
});

test("home page shows the four blocks", async ({ page }) => {
    await page.goto("/dashboard");
    for (const title of [
        "Score QHSE",
        "Alertes",
        "Prochaines actions",
        "Veille réglementaire",
    ]) {
        await expect(
            page.getByRole("heading", { level: 2, name: title }),
        ).toBeVisible();
    }
    // The pillar tile: "Environnement 77 sur 100 …".
    await page
        .getByRole("main")
        .getByRole("link", { name: /^Environnement \d+ sur 100/ })
        .click();
    await expect(page).toHaveURL(/\/domains\/environment$/);
});

test("Diagnostic appears in the sidebar only in its branch", async ({
    page,
}) => {
    const sidebar = page.getByRole("navigation", {
        name: "Navigation principale",
    });
    await page.goto("/documents");
    await expect(sidebar.getByRole("link", { name: "Diagnostic" })).toHaveCount(
        0,
    );

    await sidebar.getByRole("link", { name: "Tableau de bord" }).click();
    await sidebar.getByRole("link", { name: "Diagnostic" }).click();
    await expect(page).toHaveURL(/\/diagnostic$/);
    await expect(
        sidebar.getByRole("link", { name: "Diagnostic" }),
    ).toHaveAttribute("aria-current", "page");
});

test("opens a news article from the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page
        .getByRole("link", { name: /Tri à la source des biodéchets/ })
        .click();
    await expect(page).toHaveURL(/\/news\/news-2$/);
    await expect(
        page.getByRole("heading", {
            level: 1,
            name: /Tri à la source des biodéchets/,
        }),
    ).toBeVisible();
    await expect(
        page.getByRole("navigation", { name: "Fil d'Ariane" }),
    ).toContainText("Article");
});

test("a pillar page shows its five blocks", async ({ page }) => {
    await page.goto("/domains/safety");
    await expect(
        page.getByRole("img", { name: "Score Sécurité : 49 sur 100" }),
    ).toBeVisible();
    for (const title of [
        "Score Sécurité",
        "Actions en cours",
        "Justificatifs à renouveler",
        "Veille réglementaire",
    ]) {
        await expect(
            page.getByRole("heading", { level: 2, name: title }),
        ).toBeVisible();
    }
    await expect(page.getByText("Score par thème")).toBeVisible();
});
