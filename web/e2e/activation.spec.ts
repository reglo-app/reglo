import { expect, test } from "@playwright/test";

// The activation link opens without a session, and even when someone else
// is signed in on the browser (default storage state of the tests).
test.describe("account activation", () => {
    test("a link without token offers a new link", async ({ page }) => {
        await page.goto("/activation");

        await expect(page).toHaveURL(/\/activation$/);
        await expect(
            page.getByRole("heading", { level: 1, name: "Lien expiré" }),
        ).toBeVisible();
        await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Recevoir un nouveau lien" }),
        ).toBeVisible();
    });

    test.describe("signed out", () => {
        test.use({ storageState: { cookies: [], origins: [] } });

        test("the page is public", async ({ page }) => {
            await page.goto("/activation");
            await expect(page).toHaveURL(/\/activation$/);
        });
    });
});
