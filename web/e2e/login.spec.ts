import { expect, test } from "@playwright/test";

test.describe("login", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("a private page redirects to the login page", async ({ page }) => {
        await page.goto("/actions");

        await expect(page).toHaveURL(/\/login\?next=%2Factions$/);
        await expect(
            page.getByRole("heading", {
                level: 1,
                name: "Ravi de vous revoir !",
            }),
        ).toBeVisible();
        await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
        // exact: "Afficher le mot de passe" (toggle button) also matches.
        await expect(
            page.getByLabel("Mot de passe", { exact: true }),
        ).toBeVisible();
    });

    test("the home page leads to the login page", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
    });
});
