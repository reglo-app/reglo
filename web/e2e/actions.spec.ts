import { expect, test } from "@playwright/test";

// Pages use mock data here (see playwright.config.ts): saving, assigning and
// moving an action are covered by the unit tests and the API tests.
test("opens an action of the plan and sees its history", async ({ page }) => {
    await page.goto("/actions");

    await expect(
        page.getByRole("heading", { name: "Plan d'actions" }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Planifier l'audit interne/ }).click();

    await expect(page).toHaveURL(/\/actions\/3$/);
    await expect(
        page.getByRole("listitem").filter({ hasText: "En revue" }).first(),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Passer à « Terminée »" }),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", { name: "Historique" }),
    ).toBeVisible();
    await expect(page.getByText("Action créée")).toBeVisible();
});

test("creates an action from a priority action of the result, with the keyboard", async ({
    page,
}) => {
    await page.goto("/diagnostic/resultat");
    await page
        .getByRole("link", { name: /Créer une action : Votre document unique/ })
        .click();

    await expect(page).toHaveURL(/\/actions\/nouvelle\?/);
    await expect(
        page.getByRole("heading", { name: "Nouvelle action" }),
    ).toBeVisible();
    await expect(page.getByLabel("Titre")).toHaveValue(
        /^Votre document unique/,
    );
    await expect(page.getByLabel("Domaine")).toHaveValue("safety");

    // Every field is reached with Tab and filled with the keyboard.
    await page.getByLabel("Type").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Responsable")).toBeFocused();
    await page
        .getByLabel("Responsable")
        .selectOption({ label: "Hugo Bernard (Chef d'atelier)" });
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Échéance")).toBeFocused();
    await expect(
        page.getByRole("button", { name: "Créer l'action" }),
    ).toBeEnabled();
});
