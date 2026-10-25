import { expect, test } from "@playwright/test";

test("home page redirects to the dashboard", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/dashboard$/);
});
