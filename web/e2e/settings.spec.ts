import { expect, test } from "@playwright/test";

// Pages use mock data here (see playwright.config.ts): the saves themselves
// are covered by the unit tests and the API tests.
test("opens my profile from the user menu", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: /^Menu de Camille Martin/ }).click();
    await page.getByRole("menuitem", { name: "Mon profil" }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(
        page.getByRole("heading", { level: 1, name: "Paramètres" }),
    ).toBeVisible();
    await expect(page.getByLabel("Prénom")).toHaveValue("Camille");
    await expect(page.getByLabel("Fonction")).toHaveValue("Responsable QHSE");
    await expect(
        page.getByRole("heading", { level: 2, name: "Adresse e-mail" }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Modifier le mot de passe" }),
    ).toBeVisible();
});

test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("the e-mail confirmation link is public", async ({ page }) => {
        await page.goto("/email-confirmation");

        await expect(page).toHaveURL(/\/email-confirmation$/);
        await expect(
            page.getByRole("heading", { level: 1, name: "Lien expiré" }),
        ).toBeVisible();
    });
});
