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
    await expect(page.getByLabel("Échéance", { exact: true })).toBeFocused();
    await expect(
        page.getByRole("button", { name: "Créer l'action" }),
    ).toBeEnabled();
});

test("finds a late action with the filters, and keeps them on reload", async ({
    page,
}) => {
    await page.goto("/actions");
    const late = page.getByRole("link", { name: /Mettre à jour le DUERP/ });
    await expect(late.getByText("En retard")).toBeVisible();
    await expect(
        page
            .getByRole("link", { name: /Vérifier les extincteurs/ })
            .getByText("Échéance proche"),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("4 actions");

    const due = page.getByLabel("Échéance", { exact: true });
    await due.focus();
    await due.selectOption("overdue");

    await expect(page).toHaveURL(/\/actions\?due=overdue$/);
    await expect(page.getByRole("status")).toHaveText("1 action");
    await expect(late).toBeVisible();
    await expect(
        page.getByRole("link", { name: /Vérifier les extincteurs/ }),
    ).toHaveCount(0);
    // The list changed, the focus stayed on the filter.
    await expect(due).toBeFocused();

    await page.reload();
    await expect(page.getByLabel("Échéance", { exact: true })).toHaveValue(
        "overdue",
    );
    await expect(page.getByRole("status")).toHaveText("1 action");

    await page.getByLabel("Domaine").selectOption("quality");
    await expect(
        page.getByText("Aucune action ne correspond à ces filtres."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Effacer les filtres" }).click();
    await expect(page).toHaveURL(/\/actions$/);
    await expect(page.getByRole("status")).toHaveText("4 actions");
    await expect(page.getByLabel("Statut")).toBeFocused();
});
