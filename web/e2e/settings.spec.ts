import { expect, test } from "@playwright/test";

// Pages use mock data here (see playwright.config.ts): the saves themselves
// are covered by the unit tests and the API tests.
test("opens my profile from the user menu", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: /^Menu de Camille Martin/ }).click();
    await page.getByRole("menuitem", { name: "Mon profil" }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(
        page.getByRole("heading", { level: 1, name: "Camille Martin" }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: /photo de profil$/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Prénom")).toHaveValue("Camille");
    await expect(page.getByLabel("Fonction")).toHaveValue("Responsable QHSE");
});

test("switches between the settings tabs with the keyboard", async ({
    page,
}) => {
    await page.goto("/settings");
    const tabs = page.getByRole("tablist", { name: "Paramètres du compte" });

    await tabs.getByRole("tab", { name: "Profil" }).focus();
    await page.keyboard.press("ArrowRight");

    await expect(
        tabs.getByRole("tab", { name: "Adresse e-mail" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Nouvelle adresse e-mail")).toBeVisible();

    await page.keyboard.press("ArrowRight");

    await expect(
        page.getByRole("button", { name: "Modifier le mot de passe" }),
    ).toBeVisible();
    await expect(page.getByLabel("Prénom")).toBeHidden();
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
