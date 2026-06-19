import { test, expect } from "@playwright/test";
import { createTestSessionId, resetSession, seedTestAnswer, setSessionId } from "./helpers/session.js";
import {
  chatInput,
  connectionStatus,
  demoModeToggle,
  jobStatusBadge,
  messageByRole,
  sendButton,
  workingIndicator,
} from "./helpers/selectors.js";

async function openCleanSession(page: import("@playwright/test").Page, sessionId: string): Promise<void> {
  await setSessionId(page, sessionId);
  await page.goto("/");
  await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
  await resetSession(page);
  const demoToggle = demoModeToggle(page);
  if (await demoToggle.isChecked()) {
    await demoToggle.uncheck();
  }
}

async function ask(page: import("@playwright/test").Page, query: string): Promise<void> {
  await chatInput(page).fill(query);
  await sendButton(page).click();
}

test.describe("Affordance Atlas content journey", () => {
  test("user asks, follows up, asks another area, leaves, and returns to a ready answer", async ({ page, context }) => {
    const sessionId = createTestSessionId();
    const firstQuestion = `Where is a quiet reading room available near Testville today? ${crypto.randomUUID()}`;
    const followUpQuestion = `Is that reading room available on weekdays? ${crypto.randomUUID()}`;
    const anotherAreaQuestion = `__progress_complete__ What about deterministic availability in another area? ${crypto.randomUUID()}`;

    await openCleanSession(page, sessionId);
    await seedTestAnswer(page, firstQuestion);
    await seedTestAnswer(page, followUpQuestion);

    await ask(page, firstQuestion);
    await expect(messageByRole(page, "assistant")).toHaveCount(1, { timeout: 30000 });
    await expect(messageByRole(page, "assistant").nth(0)).toContainText("Seeded Test Library");
    await expect(messageByRole(page, "assistant").nth(0)).toContainText("Weekdays at 9:00 AM");

    await ask(page, followUpQuestion);
    await expect(messageByRole(page, "assistant")).toHaveCount(2, { timeout: 30000 });
    await expect(messageByRole(page, "assistant").nth(1)).toContainText("Seeded Test Library");
    await expect(messageByRole(page, "assistant").nth(1)).toContainText("Weekdays at 9:00 AM");

    await ask(page, anotherAreaQuestion);
    await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
    await expect(workingIndicator(page)).toBeVisible();
    await expect(jobStatusBadge(page).first()).toHaveText("running", { timeout: 30000 });

    await page.close();
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const returnPage = await context.newPage();
    await setSessionId(returnPage, sessionId);
    await returnPage.goto("/");
    await expect(connectionStatus(returnPage)).toHaveText("Online", { timeout: 60000 });

    await expect(jobStatusBadge(returnPage).first()).toHaveText("completed", { timeout: 30000 });
    await expect(messageByRole(returnPage, "assistant")).toHaveCount(3, { timeout: 30000 });
    await expect(messageByRole(returnPage, "assistant").last()).toContainText("Progression Test Place");
    await expect(messageByRole(returnPage, "assistant").last()).toContainText("daily at noon");
    await expect(workingIndicator(returnPage)).toHaveCount(0);
    await returnPage.close();
  });
});
