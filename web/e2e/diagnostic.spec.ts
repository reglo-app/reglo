import { expect, test } from "@playwright/test";

// Pages use mock data here (see playwright.config.ts): the saving of the
// answers is covered by the unit tests and the API tests.
test("starts the diagnostic from the dashboard and answers with the keyboard", async ({
    page,
}) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Faire un diagnostic" }).click();

    await expect(page).toHaveURL(/\/diagnostic$/);
    await expect(
        page.getByRole("heading", {
            name: "Faisons le point sur votre démarche QHSE",
        }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Commencer le diagnostic" }).click();
    const question = page.getByRole("heading", {
        name: "Votre entreprise a-t-elle fixé des objectifs qualité mesurables ?",
    });
    await expect(question).toBeFocused();
    await expect(page.getByText("Question 1 sur 8")).toBeVisible();

    // The choices are a real radio group: Tab, then the arrows.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio", { name: "Oui" })).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "En partie" })).toBeChecked();

    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(page.getByText("Question 2 sur 8")).toBeVisible();

    await page.getByRole("button", { name: "Voir le récapitulatif" }).click();
    await expect(
        page.getByRole("heading", { name: "Récapitulatif" }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Valider le diagnostic" }),
    ).toBeDisabled();
});
