<script setup lang="ts">
import { ref } from "vue";
import { useAffordanceAgent } from "./composables/useAffordanceAgent.js";
import AdminView from "./components/AdminView.vue";
import ChatView from "./components/ChatView.vue";
import StatusBadge from "./components/StatusBadge.vue";
import UiButton from "./components/UiButton.vue";

type AdminVisualFixture = {
  authenticated?: boolean;
  loading?: boolean;
  error?: string | null;
  copyMessage?: string | null;
  tokenInput?: string;
  savedToken?: string;
  summary?: unknown;
  tables?: unknown;
  selectedTable?: string;
  tableRows?: unknown;
  tableLoading?: boolean;
  tableOffset?: number;
  tableFilter?: string;
  tableSortColumn?: string | null;
  tableSortDirection?: "asc" | "desc";
  selectedRow?: Record<string, unknown> | null;
  selectedRowJson?: string | null;
  rowCopyMessage?: string | null;
};

type ChatVisualFixture = {
  connected?: boolean;
  connecting?: boolean;
  error?: string | null;
  input?: string;
  busy?: boolean;
  messages?: unknown;
  jobs?: unknown;
  highlightedJobId?: string | null;
};

const { connected, connecting, error, messages, jobs, busy, working, ask, cancelResearchJob, startNewSession } = useAffordanceAgent();

const isAdminPage = ref(typeof window !== "undefined" && window.location.pathname === "/admin");
const adminViewRef = ref<{ applyAdminVisualFixture?: (fixture: AdminVisualFixture) => void } | null>(null);
const chatViewRef = ref<{ applyChatVisualFixture?: (fixture: ChatVisualFixture) => void } | null>(null);

function handleNewChat() {
  if (working.value && !window.confirm("A research job is still running. Start a new chat anyway?")) return;
  startNewSession();
}

function applyVisualFixture(fixture: {
  connected?: boolean;
  connecting?: boolean;
  error?: string | null;
  busy?: boolean;
  messages?: unknown;
  jobs?: unknown;
  highlightedJobId?: string | null;
  input?: string;
  admin?: AdminVisualFixture;
}): void {
  if (fixture.connected !== undefined) connected.value = fixture.connected;
  if (fixture.connecting !== undefined) connecting.value = fixture.connecting;
  if (fixture.error !== undefined) error.value = fixture.error;
  if (fixture.busy !== undefined) busy.value = fixture.busy;
  if (fixture.messages !== undefined) messages.value = fixture.messages as typeof messages.value;
  if (fixture.jobs !== undefined) jobs.value = fixture.jobs as typeof jobs.value;
  const chatFixture: ChatVisualFixture = {};
  if (fixture.connected !== undefined) chatFixture.connected = fixture.connected;
  if (fixture.connecting !== undefined) chatFixture.connecting = fixture.connecting;
  if (fixture.error !== undefined) chatFixture.error = fixture.error;
  if (fixture.busy !== undefined) chatFixture.busy = fixture.busy;
  if (fixture.input !== undefined) chatFixture.input = fixture.input;
  if (fixture.messages !== undefined) chatFixture.messages = fixture.messages;
  if (fixture.jobs !== undefined) chatFixture.jobs = fixture.jobs;
  if (fixture.highlightedJobId !== undefined) chatFixture.highlightedJobId = fixture.highlightedJobId;
  chatViewRef.value?.applyChatVisualFixture?.(chatFixture);
  if (fixture.admin) {
    adminViewRef.value?.applyAdminVisualFixture?.(fixture.admin);
  }
}

if (typeof window !== "undefined") {
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__applyAffordanceAtlasVisualFixture = applyVisualFixture;
  }
}
</script>

<template>
  <div :class="['mx-auto min-h-screen bg-surface p-4 font-sans text-text max-md:px-3 max-md:py-2', isAdminPage ? 'max-w-[1440px]' : 'max-w-[960px]']">
    <header class="mb-4 flex flex-wrap items-center justify-between gap-4 max-md:mb-3 max-md:items-start max-md:gap-1.5">
      <h1 class="m-0 text-xl max-md:text-lg">Affordance Atlas</h1>
      <div class="flex items-center gap-3 max-md:w-full max-md:justify-start max-md:gap-2">
        <UiButton v-if="isAdminPage" as="a" class="no-underline max-md:px-2 max-md:py-1.5" href="/">Back to app</UiButton>
        <UiButton v-if="!isAdminPage" data-testid="new-chat-button" class="max-md:px-2 max-md:py-1.5" type="button" @click="handleNewChat">New chat</UiButton>
        <StatusBadge data-testid="connection-status" :tone="connecting ? 'info' : connected ? 'success' : 'danger'">{{ connecting ? "Connecting..." : connected ? "Online" : "Offline" }}</StatusBadge>
      </div>
    </header>

    <AdminView v-if="isAdminPage" ref="adminViewRef" />
    <ChatView
      v-else
      ref="chatViewRef"
      :connected="connected"
      :connecting="connecting"
      :busy="busy"
      :working="working"
      :messages="messages"
      :jobs="jobs"
      :ask="ask"
      :cancel-research-job="cancelResearchJob"
    />

    <div v-if="error" data-testid="error-banner" class="mt-4 rounded-md bg-danger-soft p-3 text-danger" role="alert">{{ error }}</div>
  </div>
</template>
