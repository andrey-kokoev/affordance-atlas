# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: research.spec.ts >> Affordance Atlas research >> real research path queues a job and keeps the UI usable
- Location: e2e\research.spec.ts:15:3

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator:  getByTestId('chat-input')
Expected: enabled
Received: disabled
Timeout:  30000ms

Call log:
  - Expect "toBeEnabled" with timeout 30000ms
  - waiting for getByTestId('chat-input')
    63 × locator resolved to <input disabled type="text" data-testid="chat-input" class="rounded-md border border-border-strong p-3" placeholder="Research is running. Cancel it or start a new chat to ask something else."/>
       - unexpected value "disabled"

```

```yaml
- textbox "Research is running. Cancel it or start a new chat to ask something else." [disabled]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { createTestSessionId, setSessionId, resetSession } from "./helpers/session.js";
  3  | import {
  4  |   connectionStatus,
  5  |   chatInput,
  6  |   sendButton,
  7  |   messageByRole,
  8  |   jobListItem,
  9  |   jobStatusBadge,
  10 | } from "./helpers/selectors.js";
  11 | 
  12 | const RESEARCH_QUERY = "Mass times St Edward the Confessor Church Clifton Park NY";
  13 | 
  14 | test.describe("Affordance Atlas research", () => {
  15 |   test("real research path queues a job and keeps the UI usable", async ({ page }) => {
  16 |     const sessionId = createTestSessionId();
  17 |     await setSessionId(page, sessionId);
  18 |     await page.goto("/");
  19 | 
  20 |     await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
  21 |     await resetSession(page);
  22 | 
  23 |     await chatInput(page).fill(RESEARCH_QUERY);
  24 |     await sendButton(page).click();
  25 | 
  26 |     await expect(messageByRole(page, "user")).toHaveText(/St Edward/);
  27 | 
  28 |     // The job should appear in the sidebar (system message may lag due to AI latency)
  29 |     await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });
  30 | 
  31 |     const queryText = await jobListItem(page).first().locator("strong").textContent();
  32 |     expect(queryText).toContain(RESEARCH_QUERY);
  33 | 
> 34 |     await expect(chatInput(page)).toBeEnabled({ timeout: 30000 });
     |                                   ^ Error: expect(locator).toBeEnabled() failed
  35 |     await chatInput(page).fill("another question");
  36 |     await expect(sendButton(page)).toBeEnabled({ timeout: 30000 });
  37 |   });
  38 | 
  39 |   test("production research smoke exposes an observable job", async ({ page }) => {
  40 |     const sessionId = createTestSessionId();
  41 |     await setSessionId(page, sessionId);
  42 |     await page.goto("/");
  43 | 
  44 |     await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
  45 |     await resetSession(page);
  46 | 
  47 |     await chatInput(page).fill(RESEARCH_QUERY);
  48 |     await sendButton(page).click();
  49 | 
  50 |     await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });
  51 |     await expect(jobStatusBadge(page).first()).toHaveText(/queued|running|completed|failed/, { timeout: 30000 });
  52 |   });
  53 | });
  54 | 
```