import { expect, test } from "@playwright/test";

// Pages use mock data here (see playwright.config.ts): who may enter and what
// the buttons change are covered by the API tests and the unit tests.
test("the REGLO team goes from the organizations to the accounts", async ({
    page,
}) => {
    await page.goto("/admin");

    await expect(
        page.getByRole("heading", { level: 1, name: "Organisations" }),
    ).toBeVisible();
    const nav = page.getByRole("navigation", {
        name: "Navigation du back office",
    });
    await expect(
        nav.getByRole("link", { name: "Organisations" }),
    ).toHaveAttribute("aria-current", "page");

    await page
        .getByRole("searchbox", { name: "Rechercher une organisation" })
        .fill("atelier demo");
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
    await page.getByRole("link", { name: "Atelier Démo" }).click();

    // The dev server compiles this page on the first click: it can be slow.
    await expect(page).toHaveURL(/\/admin\/organisations\/1$/, {
        timeout: 30_000,
    });
    await expect(
        page.getByRole("heading", { level: 1, name: "Atelier Démo" }),
    ).toBeVisible();
    await expect(page.getByText("Activation en attente")).toBeVisible();

    await nav.getByRole("link", { name: "Utilisateurs" }).click();
    await expect(page).toHaveURL(/\/admin\/utilisateurs$/);
    await expect(
        page.getByRole("heading", { level: 2, name: "Comptes (3)" }),
    ).toBeVisible();

    await nav.getByRole("link", { name: "Équipe Réglo" }).click();
    await expect(page).toHaveURL(/\/admin\/equipe$/);
    await expect(
        page.getByRole("heading", { level: 2, name: "Membres (1)" }),
    ).toBeVisible();
});

test("the creation dialog opens and closes with the keyboard", async ({
    page,
}) => {
    await page.goto("/admin");

    const open = page.getByRole("button", { name: "Créer une organisation" });
    await open.click();
    const dialog = page.getByRole("dialog", {
        name: "Créer une organisation",
    });
    await expect(dialog.getByLabel("Nom de l'organisation")).toBeVisible();
    await expect(dialog.getByLabel("Adresse e-mail")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
});

test("an organization that does not exist is not found", async ({ page }) => {
    await page.goto("/admin/organisations/999");

    await expect(
        page.getByRole("heading", { level: 1, name: "Page introuvable" }),
    ).toBeVisible();
});

test("the back office stays on a phone, without sideways scrolling", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/utilisateurs");

    await expect(
        page.getByRole("heading", { level: 2, name: "Comptes (3)" }),
    ).toBeVisible();
    const overflow = await page.evaluate(
        () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
});

test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("the back office asks to sign in", async ({ page }) => {
        await page.goto("/admin");

        await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    });
});
