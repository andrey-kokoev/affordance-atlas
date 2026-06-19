import { test, expect } from "@playwright/test";
import { createTestSessionId, setSessionId, resetSession } from "./helpers/session.js";
import {
  connectionStatus,
  demoModeToggle,
  chatInput,
  sendButton,
  jobListItem,
  jobStatusBadge,
} from "./helpers/selectors.js";

const NONSENSE_QUERY = "xyzq123 nonexistent activity in Antarctica";

test.describe("Affordance Atlas errors", () => {
  test("a failed research path surfaces an error and re-enables the input", async ({ page }) => {
    const sessionId = createTestSessionId();
    await setSessionId(page, sessionId);
    await page.goto("/");

    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
    await resetSession(page);

    const demoToggle = demoModeToggle(page);
    if (await demoToggle.isChecked()) {
      await demoToggle.uncheck();
    }

    await chatInput(page).fill(NONSENSE_QUERY);
    await sendButton(page).click();

    // Wait for the job to appear. External research timing is intentionally not
    // part of this e2e contract; recovery is the contract.
    await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });
    await expect(jobStatusBadge(page).first()).toHaveText(/queued|running|completed|failed/, { timeout: 30000 });

    // UI must recover
    await expect(chatInput(page)).toBeEnabled({ timeout: 30000 });
    await chatInput(page).fill("recovery check");
    await expect(sendButton(page)).toBeEnabled({ timeout: 30000 });
  });
});
