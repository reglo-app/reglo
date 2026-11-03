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
        page.getByRole("heading", { level: 2, name: "Membres (12)" }),
    ).toBeVisible();
    await expect(page.getByText("Camille Martin (vous)")).toBeVisible();
    await expect(
        page.getByRole("heading", {
            level: 2,
            name: "Invitations en attente (2)",
        }),
    ).toBeVisible();
    await expect(page.getByText("Expirée", { exact: true })).toBeVisible();

    // US-16: the administrator manages the others, not themself.
    await expect(
        page.getByRole("button", { name: "Actions pour Hugo Bernard" }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Actions pour Camille Martin" }),
    ).toHaveCount(0);
});

test("the members table searches, sorts and shows pages", async ({ page }) => {
    await page.goto("/team");
    const table = page.getByRole("table");

    // 12 members: 10 on the first page, 2 on the second.
    await expect(table.getByRole("row")).toHaveCount(11);
    await page
        .getByRole("navigation", { name: "Pages des membres" })
        .getByRole("button", { name: "Page 2" })
        .click();
    await expect(table.getByRole("row")).toHaveCount(3);

    await page
        .getByRole("searchbox", { name: "Rechercher un membre" })
        .fill("ines");
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByText("Inès Petit")).toBeVisible();

    await page
        .getByRole("searchbox", { name: "Rechercher un membre" })
        .fill("");
    await table.getByRole("button", { name: "Inscrit le" }).click();
    await expect(
        table.getByRole("columnheader", { name: "Inscrit le" }),
    ).toHaveAttribute("aria-sort", "descending");
    // Most recent first: Rose Lambert joined last.
    await expect(table.getByRole("row").nth(1)).toContainText("Rose Lambert");
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
