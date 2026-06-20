import { test, expect } from "@playwright/test";

test.describe("Affordance Atlas admin", () => {
  test("admin route shows bearer-token gate", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.locator("h1")).toHaveText("Affordance Atlas");
    await expect(page.locator("h2")).toHaveText("Admin");
    await expect(page.getByTestId("admin-token-input")).toBeVisible();
    await expect(page.getByTestId("admin-token-submit")).toBeDisabled();
    await expect(page.getByText("Back to app")).toBeVisible();
    await expect(page.getByTestId("new-chat-button")).toHaveCount(0);
  });
});
