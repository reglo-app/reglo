import { expect, test } from "@playwright/test";

// Pages use mock data here (see playwright.config.ts): marking a lesson as
// done is covered by the unit tests and the API tests.
test("filters the catalog and follows a free course to its last lesson", async ({
    page,
}) => {
    await page.goto("/trainings");
    await expect(
        page.getByRole("heading", { name: "Formations", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("3 formations");

    await page.getByLabel("Accès").selectOption("paid");
    await expect(page).toHaveURL(/access=paid/);
    await expect(page.getByRole("status")).toHaveText("1 formation");
    await page.getByLabel("Accès").selectOption("");
    await expect(page.getByRole("status")).toHaveText("3 formations");

    await page.getByRole("link", { name: "Initiation au DUERP" }).click();
    await expect(
        page.getByRole("heading", { name: "Initiation au DUERP", level: 1 }),
    ).toBeVisible();
    await expect(
        page.getByRole("progressbar", { name: "Progression de la formation" }),
    ).toHaveAttribute("aria-valuetext", "1 leçon terminée sur 3");

    // Lesson after lesson, with the keyboard.
    for (const title of [
        "Évaluer les risques en vidéo",
        "Guide à télécharger",
    ]) {
        await page.getByRole("link", { name: "Leçon suivante" }).focus();
        await page.keyboard.press("Enter");
        await expect(
            page.getByRole("heading", { name: title, level: 2 }),
        ).toBeVisible();
    }
    await expect(
        page.getByText("Leçon 3 sur 3", { exact: false }),
    ).toBeVisible();
    await expect(
        page.getByRole("link", { name: "Leçon suivante" }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "Marquer comme terminée" }),
    ).toBeVisible();
});

test("shows only the program of a paid course", async ({ page }) => {
    await page.goto("/trainings/hygiene-haccp");

    await expect(page.getByText("Disponible prochainement")).toBeVisible();
    await expect(
        page.getByRole("heading", { name: "Programme" }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Marquer comme terminée" }),
    ).toHaveCount(0);
});

test("shows a clear page for a course that does not exist", async ({
    page,
}) => {
    const response = await page.goto("/trainings/unknown-course");

    expect(response?.status()).toBe(404);
});
