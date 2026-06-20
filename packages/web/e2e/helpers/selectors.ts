import type { Page, Locator } from "@playwright/test";

export function connectionStatus(page: Page): Locator {
  return page.getByTestId("connection-status");
}

export function chatInput(page: Page): Locator {
  return page.getByTestId("chat-input");
}

export function sendButton(page: Page): Locator {
  return page.getByTestId("send-button");
}

export function newChatButton(page: Page): Locator {
  return page.getByTestId("new-chat-button");
}

export function messagesContainer(page: Page): Locator {
  return page.getByTestId("messages-container");
}

export function messageByRole(page: Page, role: "user" | "assistant" | "system"): Locator {
  return page.getByTestId(`message-${role}`);
}

export function jobListItems(page: Page): Locator {
  return page.getByTestId("job-list-item");
}

export function jobListItem(page: Page): Locator {
  return page.getByTestId("job-list-item");
}

export function jobStatusBadge(page: Page): Locator {
  return page.getByTestId("job-status-badge");
}

export function jobOutcome(page: Page): Locator {
  return page.getByTestId("job-outcome");
}

export function errorBanner(page: Page): Locator {
  return page.getByTestId("error-banner");
}

export function workingIndicator(page: Page): Locator {
  return page.getByTestId("working-indicator");
}
