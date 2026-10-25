import { expect, test } from "@playwright/test";

test.describe("app navigation", () => {
    test("moves between sections with the sidebar and the breadcrumb", async ({
        page,
    }) => {
        await page.goto("/dashboard");
        const sidebar = page.getByRole("navigation", {
            name: "Navigation principale",
        });

        await sidebar.getByRole("link", { name: "Plan d'actions" }).click();

        await expect(page).toHaveURL(/\/actions$/);
        await expect(
            page.getByRole("heading", { level: 1, name: "Plan d'actions" }),
        ).toBeVisible();
        await expect(
            sidebar.getByRole("link", { name: "Plan d'actions" }),
        ).toHaveAttribute("aria-current", "page");

        await page
            .getByRole("navigation", { name: "Fil d'Ariane" })
            .getByRole("link", { name: "Tableau de bord" })
            .click();
        await expect(page).toHaveURL(/\/dashboard$/);
    });

    test("uses a drawer on mobile", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/dashboard");

        await page.getByRole("button", { name: "Ouvrir le menu" }).click();
        const drawer = page.getByRole("dialog", { name: "Menu" });
        await drawer.getByRole("link", { name: "Formations" }).click();

        await expect(page).toHaveURL(/\/trainings$/);
        await expect(drawer).toBeHidden();
    });
});

test("opens the search popup from the topbar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(
        page.getByRole("dialog", { name: "Rechercher" }),
    ).toBeVisible();
    await expect(
        page.getByRole("searchbox", { name: "Rechercher dans REGLO" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
});
