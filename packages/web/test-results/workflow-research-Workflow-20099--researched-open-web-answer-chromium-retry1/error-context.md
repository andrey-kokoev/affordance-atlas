# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workflow-research.spec.ts >> Workflow-backed research >> user leaves and returns to a researched open-web answer
- Location: e2e\workflow-research.spec.ts:20:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByTestId('message-assistant').last().getByTestId('answer-evidence').first()
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('message-assistant').last().getByTestId('answer-evidence').first()
    14 × locator resolved to <div data-testid="answer-evidence" class="grid gap-1.5 border-y border-border py-2 text-sm">…</div>
       - unexpected value "hidden"

```

```yaml
- banner:
  - heading "Affordance Atlas" [level=1]
  - button "New chat"
  - text: Online
- main:
  - region "Chat":
    - strong: You
    - time: 9:04:07 PM
    - paragraph: When is Grand Central Terminal open in New York?
    - strong: System
    - time: 9:04:07 PM
    - paragraph: I’m looking that up for you. This may take a moment.
    - strong: Atlas
    - time: 9:06:14 PM
    - paragraph: Grand Central Terminal offers opening_hours on daily.
    - text: Place
    - strong: Grand Central Terminal
    - text: Grand Central Terminal, 89 E 42nd Street, New York, NY 10017 Available for
    - strong: opening_hours
    - text: When
    - strong: daily
    - text: "Confidence:"
    - strong: High confidence
    - group: Sources and evidence (1)
    - group: Caveats
    - paragraph: "Next: Verify the extracted schedule with the venue."
    - textbox "Ask when and where something is available..."
    - button "Ask" [disabled]
  - complementary "Research jobs":
    - heading "Activity" [level=2]
    - list:
      - listitem:
        - button "When is Grand Central Terminal open in New York?completed":
          - strong: When is Grand Central Terminal open in New York?
          - text: completed
        - paragraph: "Answer: Grand Central Terminal offers opening_hours on daily.. Select this job to jump to it."
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { createTestSessionId, setSessionId } from "./helpers/session.js";
  3  | import {
  4  |   chatInput,
  5  |   connectionStatus,
  6  |   jobOutcome,
  7  |   jobStatusBadge,
  8  |   messageByRole,
  9  |   sendButton,
  10 |   workingIndicator,
  11 | } from "./helpers/selectors.js";
  12 | 
  13 | async function openSession(page: import("@playwright/test").Page, sessionId: string): Promise<void> {
  14 |   await setSessionId(page, sessionId);
  15 |   await page.goto("/");
  16 |   await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
  17 | }
  18 | 
  19 | test.describe("Workflow-backed research", () => {
  20 |   test("user leaves and returns to a researched open-web answer", async ({ page, context }) => {
  21 |     test.setTimeout(300000);
  22 |     const sessionId = createTestSessionId();
  23 |     const query = "When is Grand Central Terminal open in New York?";
  24 |     await openSession(page, sessionId);
  25 | 
  26 |     await chatInput(page).fill(query);
  27 |     await sendButton(page).click();
  28 | 
  29 |     await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
  30 |     await expect(workingIndicator(page)).toBeVisible();
  31 |     await expect(jobStatusBadge(page).first()).toHaveText(/queued|running|completed/, { timeout: 30000 });
  32 | 
  33 |     await page.close();
  34 |     await new Promise((resolve) => setTimeout(resolve, 15000));
  35 | 
  36 |     const returnPage = await context.newPage();
  37 |     await setSessionId(returnPage, sessionId);
  38 |     await returnPage.goto("/");
  39 |     await expect(connectionStatus(returnPage)).toHaveText("Online", { timeout: 60000 });
  40 |     await expect(jobStatusBadge(returnPage).first()).toHaveText("completed", { timeout: 240000 });
  41 |     await expect(jobOutcome(returnPage).first()).toContainText("Answer:");
  42 |     await expect(messageByRole(returnPage, "assistant").last()).toContainText(/Confidence:/, { timeout: 30000 });
> 43 |     await expect(messageByRole(returnPage, "assistant").last().getByTestId("answer-evidence").first()).toBeVisible();
     |                                                                                                        ^ Error: expect(locator).toBeVisible() failed
  44 |     await expect(workingIndicator(returnPage)).toHaveCount(0);
  45 |     await returnPage.close();
  46 |   });
  47 | });
  48 | 
```