import { expect, test } from "@playwright/test";

// Pages use mock data here (see playwright.config.ts): the invitations
// themselves are covered by the unit tests and the API tests.
test("an administrator sees the team and the pending invitations", async ({
    page,
}) => {
    await page.goto("/dashboard");

    await page
        .getByRole("navigation")
        .getByRole("link", { name: "Équipe" })
        .click();

    await expect(page).toHaveURL(/\/team$/);
    await expect(
        page.getByRole("heading", { level: 1, name: "Équipe" }),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", { level: 2, name: "Membres (3)" }),
    ).toBeVisible();
    await expect(page.getByText("Camille Martin (vous)")).toBeVisible();
    await expect(
        page.getByRole("heading", {
            level: 2,
            name: "Invitations en attente (2)",
        }),
    ).toBeVisible();
    await expect(page.getByText("Expirée", { exact: true })).toBeVisible();

    // US-16: the administrator manages the roles.
    await expect(page.getByLabel("Rôle de Hugo Bernard")).toHaveValue("member");
    await expect(page.getByLabel("Rôle de Inès Petit")).toHaveValue("reader");
    await expect(
        page.getByRole("button", { name: "Retirer Hugo Bernard de l'équipe" }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", {
            name: "Retirer Camille Martin de l'équipe",
        }),
    ).toHaveCount(0);
});

test("the invitation dialog opens and closes with the keyboard", async ({
    page,
}) => {
    await page.goto("/team");

    await page
        .getByRole("button", { name: "Inviter un collaborateur" })
        .click();
    const dialog = page.getByRole("dialog", {
        name: "Inviter un collaborateur",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Adresse e-mail")).toBeVisible();
    await expect(dialog.getByLabel("Rôle")).toHaveValue("member");

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(
        page.getByRole("button", { name: "Inviter un collaborateur" }),
    ).toBeFocused();
});

test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("the invitation link is public", async ({ page }) => {
        await page.goto("/invitation");

        await expect(page).toHaveURL(/\/invitation$/);
        await expect(
            page.getByRole("heading", { level: 1, name: "Invitation expirée" }),
        ).toBeVisible();
    });
});
