import type { Page, Locator } from "@playwright/test";
import { jobListItems } from "./selectors.js";

export async function waitForJobStatus(
  page: Page,
  targetStatus: "queued" | "running" | "completed" | "failed",
  options: { timeout?: number; pollInterval?: number } = {},
): Promise<Locator> {
  const { timeout = 240000, pollInterval = 1000 } = options;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const items = jobListItems(page);
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const badge = items.nth(i).getByTestId("job-status-badge");
      const text = await badge.textContent().catch(() => null);
      if (text === targetStatus) {
        return items.nth(i);
      }
    }
    await page.waitForTimeout(pollInterval);
  }
  throw new Error(`Timed out waiting for job status ${targetStatus}`);
}

export async function waitForAnyTerminalJob(
  page: Page,
  options: { timeout?: number; pollInterval?: number } = {},
): Promise<{ item: Locator; status: "completed" | "failed" }> {
  const { timeout = 240000, pollInterval = 1000 } = options;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const items = jobListItems(page);
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const badge = items.nth(i).getByTestId("job-status-badge");
      const text = await badge.textContent().catch(() => null);
      if (text === "completed" || text === "failed") {
        return { item: items.nth(i), status: text };
      }
    }
    await page.waitForTimeout(pollInterval);
  }
  throw new Error("Timed out waiting for any terminal job status");
}
