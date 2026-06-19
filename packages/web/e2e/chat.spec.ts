import { test, expect } from "@playwright/test";

test.describe("Affordance Atlas chat", () => {
  test("demo mode returns an answer for a sample query", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toHaveText("Affordance Atlas");
    await expect(page.locator("text=Connecting...")).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Online")).toBeVisible();

    await page.locator('label:has-text("Demo mode") input[type="checkbox"]').check();

    const input = page.locator('input[placeholder="Ask when and where something is available..."]');
    await input.fill("Where can I play pickleball in NYC this weekend?");
    await input.press("Enter");

    await expect(page.locator(".message.user")).toHaveText(/pickleball/, { timeout: 120000 });
    await expect(page.locator(".message.assistant")).toBeVisible({ timeout: 120000 });

    const answerText = await page.locator(".message.assistant .bubble").textContent();
    expect(answerText).toBeTruthy();
  });
});
