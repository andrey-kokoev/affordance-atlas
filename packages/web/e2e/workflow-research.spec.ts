import { test, expect } from "@playwright/test";
import { createTestSessionId, setSessionId } from "./helpers/session.js";
import {
  chatInput,
  connectionStatus,
  jobOutcome,
  jobStatusBadge,
  messageByRole,
  sendButton,
  workingIndicator,
} from "./helpers/selectors.js";

async function openSession(page: import("@playwright/test").Page, sessionId: string): Promise<void> {
  await setSessionId(page, sessionId);
  await page.goto("/");
  await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
}

test.describe("Workflow-backed research", () => {
  test("user leaves and returns to a researched open-web answer", async ({ page, context }) => {
    test.setTimeout(300000);
    const sessionId = createTestSessionId();
    const query = "When is Grand Central Terminal open in New York?";
    await openSession(page, sessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
    await expect(workingIndicator(page)).toBeVisible();
    await expect(jobStatusBadge(page).first()).toHaveText(/queued|running|completed/, { timeout: 30000 });

    await page.close();
    await new Promise((resolve) => setTimeout(resolve, 15000));

    const returnPage = await context.newPage();
    await setSessionId(returnPage, sessionId);
    await returnPage.goto("/");
    await expect(connectionStatus(returnPage)).toHaveText("Online", { timeout: 60000 });
    await expect(jobStatusBadge(returnPage).first()).toHaveText("completed", { timeout: 240000 });
    await expect(jobOutcome(returnPage).first()).toContainText("Answer:");
    await expect(messageByRole(returnPage, "assistant").last()).toContainText(/Confidence:/, { timeout: 30000 });
    await expect(messageByRole(returnPage, "assistant").last().getByTestId("answer-evidence").first()).toBeVisible();
    await expect(workingIndicator(returnPage)).toHaveCount(0);
    await returnPage.close();
  });
});
