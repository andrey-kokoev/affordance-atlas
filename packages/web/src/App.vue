<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import type { Answer, AnswerResult } from "@affordance-atlas/domain";
import { useAffordanceAgent } from "./composables/useAffordanceAgent.js";

const { connected, connecting, error, messages, jobs, busy, working, ask, cancelResearchJob, startNewSession } = useAffordanceAgent();

const input = ref("");
const messagesEl = ref<HTMLDivElement | null>(null);
const isAdminPage = ref(typeof window !== "undefined" && window.location.pathname === "/admin");

const ADMIN_TOKEN_KEY = "affordance-atlas-admin-token";

type AdminSummary = {
  generated_at: string;
  status_counts: { status: string; count: number }[];
  recent_jobs: {
    research_job_id: string;
    original_user_query: string;
    status: string;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
  }[];
};

type AdminTable = {
  name: string;
  label: string;
  count: number;
};

type AdminTableRows = {
  table: AdminTable;
  limit: number;
  offset: number;
  rows: Record<string, unknown>[];
};

const adminTokenInput = ref("");
const savedAdminToken = ref("");
const adminAuthenticated = ref(false);
const adminLoading = ref(false);
const adminError = ref<string | null>(null);
const adminCopyMessage = ref<string | null>(null);
const adminSummary = ref<AdminSummary | null>(null);
const adminTables = ref<AdminTable[]>([]);
const selectedAdminTable = ref<string>("research_job");
const adminTableRows = ref<AdminTableRows | null>(null);
const adminTableLoading = ref(false);
const adminTableOffset = ref(0);
const adminTableLimit = 25;

type SessionJob = (typeof jobs.value)[number];
type SessionMessage = (typeof messages.value)[number];
type AssistantMessage = Extract<SessionMessage, { role: "assistant" }>;

type VisualFixture = {
  connected?: boolean;
  connecting?: boolean;
  error?: string | null;
  input?: string;
  busy?: boolean;
  messages?: SessionMessage[];
  jobs?: SessionJob[];
  highlightedJobId?: string | null;
  admin?: {
    authenticated?: boolean;
    loading?: boolean;
    error?: string | null;
    copyMessage?: string | null;
    tokenInput?: string;
    savedToken?: string;
    summary?: AdminSummary | null;
    tables?: AdminTable[];
    selectedTable?: string;
    tableRows?: AdminTableRows | null;
    tableLoading?: boolean;
    tableOffset?: number;
  };
};

const nowMs = ref(Date.now());
const highlightedJobId = ref<string | null>(null);
const canSend = computed(() => connected.value && !busy.value && !working.value && input.value.trim().length > 0);
const hasMessages = computed(() => messages.value.length > 0);
const activeJobs = computed(() => jobs.value.filter((job) => job.status === "queued" || job.status === "running"));
const primaryActiveJob = computed(() => activeJobs.value[0] ?? null);
const inputPlaceholder = computed(() => {
  if (!connected.value) return "Connect before asking...";
  if (working.value) return "Research is running. Cancel it or start a new chat to ask something else.";
  return "Ask when and where something is available...";
});
const sendLabel = computed(() => {
  if (working.value) return "Researching";
  if (busy.value) return "Sending";
  return "Ask";
});

type ResultQuality = {
  unverified: boolean;
  problems: string[];
  safePlace: string | null;
  safeWhen: string | null;
  confidenceLabel: string;
};

function normalizeDisplayText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function looksLikeDomain(value: string | null | undefined): boolean {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  return /^https?:\/\//i.test(normalized) || /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/.*)?$/i.test(normalized);
}

function hasScheduleSignal(value: string | null | undefined): boolean {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  return /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|daily|weekly|every|am|pm|a\.m\.|p\.m\.)\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)\b/i.test(normalized);
}

function looksLikeNavigationText(value: string | null | undefined): boolean {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  const navTerms = ["home", "find", "guides", "about", "add a", "privacy", "menu", "search", "contact"];
  const hitCount = navTerms.filter((term) => normalized.toLowerCase().includes(term)).length;
  return hitCount >= 3 || (/\bhome\b/i.test(normalized) && normalized.length > 100 && !hasScheduleSignal(normalized));
}

function confidenceLabel(value: AnswerResult["confidence_state"]): string {
  const labels: Record<AnswerResult["confidence_state"], string> = {
    high_confidence: "High confidence",
    probable: "Probable",
    candidate: "Unverified lead",
    insufficient: "Insufficient support",
  };
  return labels[value];
}

function resultQuality(result: AnswerResult): ResultQuality {
  const safePlace = normalizeDisplayText(result.place_label);
  const safeWhen = normalizeDisplayText(result.occurrence.recurrence_label);
  const problems: string[] = [];

  if (!safePlace || looksLikeDomain(safePlace) || looksLikeNavigationText(safePlace)) {
    problems.push("Place was not verified from the extracted source text.");
  }
  if (!safeWhen || looksLikeDomain(safeWhen) || looksLikeNavigationText(safeWhen) || !hasScheduleSignal(safeWhen)) {
    problems.push("Schedule/time was not verified from the extracted source text.");
  }
  if (result.confidence_state === "candidate" || result.verification_state === "candidate") {
    problems.push("The extracted result is only an unverified lead.");
  }

  return {
    unverified: problems.length > 0,
    problems: [...new Set(problems)],
    safePlace: problems.some((problem) => problem.startsWith("Place")) ? null : safePlace,
    safeWhen: problems.some((problem) => problem.startsWith("Schedule")) ? null : safeWhen,
    confidenceLabel: confidenceLabel(result.confidence_state),
  };
}

function answerHasOnlyUnverifiedResults(answer: Answer): boolean {
  return answer.results.length > 0 && answer.results.every((result) => resultQuality(result).unverified);
}

function answerLead(answer: Answer): string {
  if (answerHasOnlyUnverifiedResults(answer)) {
    return "I found a possible source but could not verify the schedule.";
  }
  return answer.answer_summary;
}

async function handleSubmit() {
  const query = input.value.trim();
  if (!query || !canSend.value) return;
  input.value = "";
  await ask(query);
}

function askExample(query: string) {
  input.value = query;
  void handleSubmit();
}

async function handleCancelActiveJob(): Promise<void> {
  const job = primaryActiveJob.value;
  if (!job) return;
  await cancelResearchJob(job.job_id);
}

function handleNewChat() {
  if (working.value && !window.confirm("A research job is still running. Start a new chat anyway?")) return;
  startNewSession();
}

function adminHeaders(token = savedAdminToken.value): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function loadAdminSummary(): Promise<void> {
  const response = await fetch("/api/admin/summary", { headers: adminHeaders() });
  const data = await response.json() as AdminSummary & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Unable to load admin summary.");
  adminSummary.value = data;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 240)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const jsonValue = JSON.stringify(value);
  return jsonValue.length > 240 ? `${jsonValue.slice(0, 240)}...` : jsonValue;
}

const selectedAdminColumns = computed(() => {
  const rows = adminTableRows.value?.rows ?? [];
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
});

const canPageAdminBack = computed(() => adminTableOffset.value > 0);
const canPageAdminForward = computed(() => {
  const table = adminTableRows.value?.table;
  return table ? adminTableOffset.value + adminTableLimit < table.count : false;
});

async function loadAdminTables(): Promise<void> {
  const response = await fetch("/api/admin/tables", { headers: adminHeaders() });
  const data = await response.json() as { tables?: AdminTable[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Unable to load admin tables.");
  adminTables.value = data.tables ?? [];
  if (!adminTables.value.some((table) => table.name === selectedAdminTable.value)) {
    selectedAdminTable.value = adminTables.value[0]?.name ?? "research_job";
  }
}

async function loadAdminTableRows(tableName = selectedAdminTable.value, offset = adminTableOffset.value): Promise<void> {
  if (!tableName) return;
  adminTableLoading.value = true;
  adminError.value = null;
  try {
    const params = new URLSearchParams({ limit: String(adminTableLimit), offset: String(offset) });
    const response = await fetch(`/api/admin/tables/${encodeURIComponent(tableName)}?${params}`, { headers: adminHeaders() });
    const data = await response.json() as AdminTableRows & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to load table rows.");
    selectedAdminTable.value = tableName;
    adminTableOffset.value = offset;
    adminTableRows.value = data;
  } finally {
    adminTableLoading.value = false;
  }
}

async function selectAdminTable(tableName: string): Promise<void> {
  await loadAdminTableRows(tableName, 0);
}

async function pageAdminTable(direction: "previous" | "next"): Promise<void> {
  const delta = direction === "next" ? adminTableLimit : -adminTableLimit;
  await loadAdminTableRows(selectedAdminTable.value, Math.max(0, adminTableOffset.value + delta));
}

async function validateAdminToken(token = adminTokenInput.value.trim()): Promise<void> {
  if (!token) return;
  adminLoading.value = true;
  adminError.value = null;
  adminCopyMessage.value = null;
  try {
    const response = await fetch("/api/admin/session", { headers: adminHeaders(token) });
    const data = await response.json() as { authenticated?: boolean; error?: string };
    if (!response.ok || !data.authenticated) throw new Error(data.error ?? "Invalid admin bearer token.");
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    savedAdminToken.value = token;
    adminTokenInput.value = token;
    adminAuthenticated.value = true;
    await Promise.all([loadAdminSummary(), loadAdminTables()]);
    await loadAdminTableRows(selectedAdminTable.value, 0);
  } catch (err) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    savedAdminToken.value = "";
    adminAuthenticated.value = false;
    adminSummary.value = null;
    adminTables.value = [];
    adminTableRows.value = null;
    adminError.value = err instanceof Error ? err.message : String(err);
  } finally {
    adminLoading.value = false;
  }
}

async function copyAdminToken(kind: "raw" | "bearer"): Promise<void> {
  if (!savedAdminToken.value) return;
  const value = kind === "bearer" ? `Authorization: Bearer ${savedAdminToken.value}` : savedAdminToken.value;
  await navigator.clipboard.writeText(value);
  adminCopyMessage.value = kind === "bearer" ? "Authorization header copied." : "Token copied.";
}

function clearAdminToken(): void {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  savedAdminToken.value = "";
  adminTokenInput.value = "";
  adminAuthenticated.value = false;
  adminSummary.value = null;
  adminTables.value = [];
  adminTableRows.value = null;
  adminError.value = null;
  adminCopyMessage.value = null;
}

function applyVisualFixture(fixture: VisualFixture): void {
  (window as unknown as Record<string, unknown>).__affordanceAtlasVisualFixtureActive = true;
  if (fixture.connected !== undefined) connected.value = fixture.connected;
  if (fixture.connecting !== undefined) connecting.value = fixture.connecting;
  if (fixture.error !== undefined) error.value = fixture.error;
  if (fixture.input !== undefined) input.value = fixture.input;
  if (fixture.busy !== undefined) busy.value = fixture.busy;
  if (fixture.messages) messages.value = fixture.messages;
  if (fixture.jobs) jobs.value = fixture.jobs;
  if (fixture.highlightedJobId !== undefined) highlightedJobId.value = fixture.highlightedJobId;

  const admin = fixture.admin;
  if (admin) {
    if (admin.authenticated !== undefined) adminAuthenticated.value = admin.authenticated;
    if (admin.loading !== undefined) adminLoading.value = admin.loading;
    if (admin.error !== undefined) adminError.value = admin.error;
    if (admin.copyMessage !== undefined) adminCopyMessage.value = admin.copyMessage;
    if (admin.tokenInput !== undefined) adminTokenInput.value = admin.tokenInput;
    if (admin.savedToken !== undefined) savedAdminToken.value = admin.savedToken;
    if (admin.summary !== undefined) adminSummary.value = admin.summary;
    if (admin.tables !== undefined) adminTables.value = admin.tables;
    if (admin.selectedTable !== undefined) selectedAdminTable.value = admin.selectedTable;
    if (admin.tableRows !== undefined) adminTableRows.value = admin.tableRows;
    if (admin.tableLoading !== undefined) adminTableLoading.value = admin.tableLoading;
    if (admin.tableOffset !== undefined) adminTableOffset.value = admin.tableOffset;
  }
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__applyAffordanceAtlasVisualFixture = applyVisualFixture;
}

let clockTimer: ReturnType<typeof window.setInterval> | null = null;

onMounted(() => {
  clockTimer = window.setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);

  if (!isAdminPage.value) return;
  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  adminTokenInput.value = token;
  savedAdminToken.value = token;
  if (token) void validateAdminToken(token);
});

onUnmounted(() => {
  if (clockTimer !== null) window.clearInterval(clockTimer);
});

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return "";
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatElapsedSince(iso: string): string {
  const startMs = new Date(iso).getTime();
  if (!Number.isFinite(startMs)) return "";
  const totalSeconds = Math.max(0, Math.floor((nowMs.value - startMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
}

function jobPhase(job: SessionJob): string {
  if (job.status === "queued") return "Queued for research";
  if (job.status === "running") return "Checking sources";
  if (job.status === "completed") return "Completed";
  if (job.status === "cancelled") return "Canceled";
  return "Needs review";
}

function friendlyFailure(job: SessionJob): string {
  if (job.status === "cancelled") return "Research was canceled before Atlas completed an answer.";
  return `Atlas could not verify a reliable answer for "${job.query_snapshot.original_user_query}" from accessible sources.`;
}

function messageKey(msg: SessionMessage, idx: number): string {
  return `${msg.role}-${msg.createdAt}-${idx}`;
}

function messageDomId(idx: number): string {
  return `message-${idx}`;
}

function findMessageIndexForJob(job: SessionJob): number {
  if (job.result_answer_id) {
    const answerIndex = messages.value.findIndex((message) => message.role === "assistant" && message.answer?.answer_id === job.result_answer_id);
    if (answerIndex >= 0) return answerIndex;
  }

  const query = job.query_snapshot.original_user_query;
  if (job.status === "failed") {
    const failedIndex = messages.value.findIndex((message) => message.role === "assistant" && message.content.includes(query));
    if (failedIndex >= 0) return failedIndex;
  }

  return messages.value.findIndex((message) => message.role === "user" && message.content === query);
}

function answerPreviewForJob(job: SessionJob): string | null {
  if (!job.result_answer_id) return null;
  const message = messages.value.find((item): item is AssistantMessage => item.role === "assistant" && item.answer?.answer_id === job.result_answer_id);
  const summary = message?.answer ? answerLead(message.answer) : null;
  if (!summary) return null;
  return summary.length > 120 ? `${summary.slice(0, 120)}...` : summary;
}

function focusJob(job: SessionJob): void {
  highlightedJobId.value = job.job_id;
  const messageIndex = findMessageIndexForJob(job);
  const target = messageIndex >= 0
    ? document.getElementById(messageDomId(messageIndex))
    : document.querySelector(`[data-job-id="${job.job_id}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    if (highlightedJobId.value === job.job_id) highlightedJobId.value = null;
  }, 1800);
}

function scrollToBottom() {
  const el = messagesEl.value;
  if (!el) return;
  const latest = el.lastElementChild instanceof HTMLElement ? el.lastElementChild : null;
  if (latest && latest.offsetHeight > el.clientHeight) {
    el.scrollTop = Math.max(0, latest.offsetTop - el.offsetTop);
    return;
  }
  el.scrollTop = el.scrollHeight;
}

watch(
  messages,
  () => {
    void nextTick(scrollToBottom);
  },
  { deep: true },
);

const exampleQueries = [
  "When can I visit the Statue of Liberty National Monument this week?",
  "What time is Sunday Mass at St. Patrick's Cathedral in New York?",
  "When is the Union Square Greenmarket open in Manhattan?",
];
</script>

<template>
    <div :class="['mx-auto min-h-screen bg-surface p-4 font-sans text-text max-md:px-3 max-md:py-2', isAdminPage ? 'max-w-[1440px]' : 'max-w-[960px]']">
      <header class="mb-4 flex flex-wrap items-center justify-between gap-4 max-md:mb-3 max-md:items-start max-md:gap-1.5">
        <h1 class="m-0 text-xl max-md:text-lg">Affordance Atlas</h1>
        <div class="flex items-center gap-3 max-md:w-full max-md:justify-start max-md:gap-2">
          <a v-if="isAdminPage" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text no-underline hover:bg-surface-muted max-md:px-2 max-md:py-1.5" href="/">
            Back to app
          </a>
          <button v-if="!isAdminPage" data-testid="new-chat-button" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text hover:bg-surface-muted max-md:px-2 max-md:py-1.5" type="button" @click="handleNewChat">
            New chat
          </button>
          <span data-testid="connection-status" :class="['rounded-full px-2 py-1 text-sm max-md:text-xs', connecting ? 'bg-info-soft text-info' : connected ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger']">
            {{ connecting ? "Connecting..." : connected ? "Online" : "Offline" }}
          </span>
        </div>
      </header>

      <section v-if="isAdminPage" :class="['mx-auto', adminAuthenticated ? 'max-w-[1280px]' : 'max-w-[720px]']" aria-label="Admin">
        <div class="rounded-md bg-surface-subtle p-3 shadow-panel">
          <div class="grid gap-1">
            <h2 class="m-0">Admin</h2>
            <p class="muted text-sm text-muted">{{ adminAuthenticated ? "Operational status and table data for the current worker." : "Enter the admin bearer token to unlock operational status." }}</p>
          </div>

          <form v-if="!adminAuthenticated" class="mt-4 grid gap-2" @submit.prevent="validateAdminToken()">
            <label for="admin-token" class="text-xs font-semibold text-text-subtle">Bearer token</label>
            <input
              id="admin-token"
              v-model="adminTokenInput"
              data-testid="admin-token-input"
              type="password"
              autocomplete="current-password"
              placeholder="Paste admin bearer token"
              class="rounded-md border border-border-strong p-3"
            />
            <button data-testid="admin-token-submit" class="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-primary px-3 py-2 text-sm text-primary-text disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted" type="submit" :disabled="adminLoading || adminTokenInput.trim().length === 0">
              {{ adminLoading ? "Verifying..." : "Unlock admin" }}
            </button>
          </form>

          <div v-else>
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <p class="text-xs font-semibold text-text-subtle">Saved bearer token</p>
                <code data-testid="admin-token-mask" class="mt-1 block text-text">{{ "*".repeat(Math.min(savedAdminToken.length, 24)) }}</code>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-primary px-3 py-2 text-sm text-primary-text hover:bg-primary-strong" @click="copyAdminToken('raw')">Copy token</button>
                <button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-primary px-3 py-2 text-sm text-primary-text hover:bg-primary-strong" @click="copyAdminToken('bearer')">Copy header</button>
                <button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-danger bg-surface px-3 py-2 text-sm text-danger hover:bg-danger-soft" @click="clearAdminToken">Forget token</button>
              </div>
            </div>
            <p v-if="adminCopyMessage" data-testid="admin-copy-message" class="text-sm text-muted">{{ adminCopyMessage }}</p>

            <div class="mt-3 grid gap-3" data-testid="admin-summary">
              <div>
                <h3 class="m-0">Research Jobs</h3>
                <p class="text-sm text-muted">Updated {{ adminSummary ? formatDateTime(adminSummary.generated_at) : "" }}</p>
              </div>
              <div class="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2 max-md:grid-cols-[repeat(auto-fit,minmax(96px,1fr))]">
                <div v-for="row in adminSummary?.status_counts ?? []" :key="row.status" class="rounded-md bg-surface p-2 shadow-card">
                  <span class="block text-xs text-muted">{{ row.status }}</span>
                  <strong class="mt-1 block text-lg">{{ row.count }}</strong>
                </div>
              </div>
              <details>
                <summary class="cursor-pointer py-1 text-sm font-bold text-text-subtle">Recent Jobs</summary>
                <ol v-if="adminSummary && adminSummary.recent_jobs.length > 0" class="m-0 mt-2 pl-5">
                  <li v-for="job in adminSummary.recent_jobs" :key="job.research_job_id" class="mb-3">
                    <strong>{{ job.status }}</strong>
                    <span class="mt-0.5 block">{{ job.original_user_query }}</span>
                    <small class="block text-xs text-muted">{{ formatDateTime(job.created_at) }}</small>
                    <p v-if="job.error_message" class="m-0 mt-1 text-sm text-danger">{{ job.error_message }}</p>
                  </li>
                </ol>
                <p v-else class="text-sm text-muted">No jobs found.</p>
              </details>

              <div class="grid gap-2 border-t border-border pt-3" data-testid="admin-table-explorer">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 class="m-0">Data Tables</h3>
                    <p class="text-sm text-muted">Browse allowlisted D1 tables.</p>
                  </div>
                  <button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-55" :disabled="adminTableLoading" @click="loadAdminTableRows()">
                    {{ adminTableLoading ? "Loading..." : "Refresh" }}
                  </button>
                </div>

                <div class="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Admin data tables">
                  <button
                    v-for="table in adminTables"
                    :key="table.name"
                    type="button"
                    role="tab"
                    :aria-selected="selectedAdminTable === table.name"
                    :class="['inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1.5 text-sm', selectedAdminTable === table.name ? 'border-primary bg-primary-soft text-primary-strong' : 'border-border-strong bg-surface text-text']"
                    @click="selectAdminTable(table.name)"
                  >
                    <span>{{ table.label }}</span>
                    <small class="text-muted">{{ table.count }}</small>
                  </button>
                </div>

                <div v-if="adminTableRows" class="flex flex-wrap items-center justify-between gap-2">
                  <span>{{ adminTableRows.table.label }}</span>
                  <span>{{ adminTableRows.table.count === 0 ? "0 of 0" : `${adminTableRows.offset + 1}-${Math.min(adminTableRows.offset + adminTableRows.rows.length, adminTableRows.table.count)} of ${adminTableRows.table.count}` }}</span>
                  <div class="flex gap-2">
                    <button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-55" :disabled="!canPageAdminBack || adminTableLoading" @click="pageAdminTable('previous')">Previous</button>
                    <button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-55" :disabled="!canPageAdminForward || adminTableLoading" @click="pageAdminTable('next')">Next</button>
                  </div>
                </div>

                <div class="max-h-[68vh] w-full overflow-x-auto overflow-y-auto rounded-md border border-border bg-surface max-md:max-h-[58vh]">
                  <table v-if="adminTableRows && adminTableRows.rows.length > 0" data-testid="admin-data-table" class="min-w-max table-fixed border-collapse text-xs leading-[1.3]">
                    <thead>
                      <tr>
                        <th v-for="column in selectedAdminColumns" :key="column" class="sticky top-0 z-[1] w-[300px] min-w-[300px] max-w-[440px] whitespace-nowrap border-b border-border bg-surface-subtle px-3 py-2.5 text-left align-top font-semibold">{{ column }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, rowIndex) in adminTableRows.rows" :key="rowIndex">
                        <td v-for="column in selectedAdminColumns" :key="column" class="w-[300px] min-w-[300px] max-w-[440px] whitespace-pre-wrap border-b border-border px-3 py-2.5 text-left align-top leading-[1.45] [overflow-wrap:anywhere]">
                          <span class="line-clamp-3 overflow-hidden" :title="formatCellValue(row[column])">{{ formatCellValue(row[column]) }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p v-else class="text-sm text-muted">No rows for this table.</p>
                </div>
              </div>
            </div>
          </div>

          <p v-if="adminError" data-testid="admin-error" class="m-0 mt-1 text-sm text-danger">{{ adminError }}</p>
        </div>
      </section>

      <main v-else class="grid grid-cols-[1fr_280px] gap-4 max-md:grid-cols-1 max-md:gap-3">
        <section class="flex min-h-0 flex-col gap-3 max-md:min-h-auto" aria-label="Chat">
          <div ref="messagesEl" data-testid="messages-container" class="flex max-h-[min(72vh,46rem)] flex-col gap-3 overflow-y-auto p-1 max-md:p-0" aria-live="polite" aria-relevant="additions text">
          <div v-if="!hasMessages" class="px-4 py-5 text-center text-text-subtle max-md:px-1 max-md:py-3">
            <h2 class="m-0 mb-3 text-lg">Ask when and where something is available</h2>
            <p class="text-sm text-muted">Live research examples; Atlas will verify sources before answering.</p>
            <ul class="m-0 mt-2 flex list-none flex-col gap-2 p-0">
              <li v-for="q in exampleQueries" :key="q">
                <button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-full border border-info-border bg-primary-soft px-3 py-2 text-sm text-info hover:bg-info-soft" @click="askExample(q)">{{ q }}</button>
              </li>
            </ul>
          </div>

          <div
            v-for="(msg, idx) in messages"
            :id="messageDomId(idx)"
            :key="messageKey(msg, idx)"
            :data-testid="`message-${msg.role}`"
            :class="['flex', msg.role === 'user' ? 'justify-end' : '']"
          >
            <div class="max-w-[80%] rounded-lg px-4 py-3 max-md:max-w-full" :class="msg.role === 'user' ? 'bg-primary text-primary-text' : msg.role === 'system' ? 'bg-info-muted text-info' : 'bg-surface-muted'">
              <div class="mb-1 flex justify-between gap-4 text-xs opacity-70">
                <strong>{{ msg.role === "user" ? "You" : msg.role === "assistant" ? "Atlas" : "System" }}</strong>
                <time v-if="msg.createdAt">{{ formatTime(msg.createdAt) }}</time>
              </div>
              <template v-if="msg.role === 'assistant' && msg.answer">
                <p :class="['m-0 mt-1 mb-2 text-base', answerHasOnlyUnverifiedResults(msg.answer) ? 'font-bold text-warning' : '']">{{ answerLead(msg.answer) }}</p>
                <section
                  v-for="result in msg.answer.results"
                  :key="result.result_id"
                  data-testid="answer-result"
                  :class="['mt-2 grid gap-2 border-t border-border-strong pt-2', resultQuality(result).unverified ? 'border-warning-border' : '']"
                >
                  <div v-if="resultQuality(result).unverified" class="rounded-md border border-warning-border bg-warning-soft p-2 text-warning-strong" role="status">
                    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <strong>{{ resultQuality(result).confidenceLabel }}</strong>
                      <span class="text-xs">Source found; schedule not verified.</span>
                    </div>
                    <ul class="m-0 mt-1 pl-4 text-xs">
                      <li v-for="problem in resultQuality(result).problems" :key="problem">{{ problem }}</li>
                    </ul>
                  </div>

                  <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2 max-md:grid-cols-1">
                    <div class="grid gap-0.5">
                      <span class="text-xs font-bold uppercase tracking-[0.04em] text-muted">Place</span>
                      <strong>{{ resultQuality(result).safePlace ?? "Not verified" }}</strong>
                      <span v-if="result.place_address && resultQuality(result).safePlace" class="text-sm text-muted">{{ result.place_address }}</span>
                    </div>
                    <div class="grid gap-0.5">
                      <span class="text-xs font-bold uppercase tracking-[0.04em] text-muted">Available for</span>
                      <strong>{{ result.affordance_label }}</strong>
                    </div>
                    <div class="grid gap-0.5">
                      <span class="text-xs font-bold uppercase tracking-[0.04em] text-muted">When</span>
                      <strong class="font-medium text-info">{{ resultQuality(result).safeWhen ?? "Not verified" }}</strong>
                    </div>
                    <div class="grid gap-0.5">
                      <span class="text-xs font-bold uppercase tracking-[0.04em] text-muted">Confidence:</span>
                      <strong>{{ resultQuality(result).confidenceLabel }}</strong>
                    </div>
                  </div>

                  <details class="border-t border-border pt-2 text-sm">
                    <summary class="cursor-pointer py-1 font-semibold text-text-subtle">Sources and evidence ({{ result.evidence.length }})</summary>
                    <div v-for="item in result.evidence" :key="item.evidence_item_id" data-testid="answer-evidence" class="grid gap-1.5 border-y border-border py-2 text-sm">
                      <div class="grid gap-0.5">
                        <span class="text-xs font-bold uppercase tracking-[0.04em] text-muted">Source</span>
                        <a data-testid="answer-source-link" :href="item.source_url" target="_blank" rel="noreferrer" class="text-primary-strong [overflow-wrap:anywhere] hover:underline focus-visible:underline">{{ item.source_title || item.source_url }}</a>
                        <span class="text-sm text-muted">Retrieved {{ formatDateTime(item.retrieved_at) }}</span>
                      </div>
                      <p v-if="item.evidence_span" class="m-0 text-text-subtle">{{ item.evidence_span }}</p>
                      <p class="m-0 text-text">{{ item.extracted_text }}</p>
                    </div>
                  </details>

                  <details v-if="result.caveats.length > 0" class="border-t border-border pt-2 text-sm">
                    <summary class="cursor-pointer py-1 font-semibold text-text-subtle">Caveats</summary>
                    <p class="mt-2 text-sm text-warning">{{ result.caveats.join(" ") }}</p>
                  </details>
                </section>
                <p v-if="msg.answer.next_actions.length > 0" class="mt-2 text-sm text-text-subtle">
                  Next: {{ msg.answer.next_actions.map((a) => a.label).join("; ") }}
                </p>
              </template>
              <p v-else class="m-0 [overflow-wrap:anywhere]">{{ msg.content }}</p>
            </div>
          </div>

          <div v-if="primaryActiveJob" data-testid="working-indicator" class="flex" role="status" aria-live="polite">
            <div class="max-w-[80%] rounded-lg bg-info-muted px-4 py-3 text-info max-md:max-w-full">
              <div class="mb-1 flex justify-between gap-4 text-xs opacity-70">
                <strong>Atlas</strong>
                <time>{{ formatElapsedSince(primaryActiveJob.created_at) }}</time>
              </div>
              <div class="grid gap-1">
                <strong>{{ jobPhase(primaryActiveJob) }}</strong>
                <p class="m-0 text-text-subtle">{{ primaryActiveJob.query_snapshot.original_user_query }}</p>
                <small class="text-info">Research can take a minute when Atlas has to verify live sources.</small>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-info-border bg-surface px-3 py-2 text-sm text-info hover:bg-info-muted" @click="focusJob(primaryActiveJob)">View job</button>
                <button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-info-border bg-surface px-3 py-2 text-sm text-info hover:bg-info-muted" @click="handleCancelActiveJob">Cancel research</button>
              </div>
            </div>
          </div>
        </div>

        <form class="grid grid-cols-[1fr_auto] gap-2 max-md:grid-cols-1" @submit.prevent="handleSubmit">
            <input
              v-model="input"
              data-testid="chat-input"
              type="text"
              :placeholder="inputPlaceholder"
              :disabled="!connected || busy || working"
              class="rounded-md border border-border-strong p-3"
            />
            <button data-testid="send-button" class="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-primary px-3 py-2 text-sm text-primary-text disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted" type="submit" :disabled="!canSend">
            {{ sendLabel }}
          </button>
        </form>
      </section>

      <aside class="self-start rounded-md bg-surface-subtle p-3 shadow-panel max-md:rounded-none max-md:border-t max-md:border-border max-md:bg-transparent max-md:px-0 max-md:pb-0 max-md:pt-2 max-md:shadow-none" aria-label="Research jobs">
        <h2 class="m-0 mb-2 text-sm max-md:mb-1.5">Activity</h2>
        <ul v-if="jobs.length > 0" class="m-0 flex list-none flex-col gap-2 p-0 max-md:gap-1.5">
          <li
            v-for="job in jobs"
            :key="job.job_id"
            :data-job-id="job.job_id"
            data-testid="job-list-item"
            :class="['rounded-md bg-surface p-2 shadow-card transition-shadow max-md:px-2 max-md:py-2', highlightedJobId === job.job_id ? '[box-shadow:var(--focus-ring),var(--shadow-card)]' : '']"
          >
            <button type="button" class="block w-full cursor-pointer border-0 bg-transparent p-0 text-left text-inherit" @click="focusJob(job)">
              <strong class="hover:underline">{{ job.query_snapshot.original_user_query }}</strong>
              <span
                data-testid="job-status-badge"
                :class="[
                  'ml-2 rounded-sm px-1.5 py-0.5 text-xs uppercase',
                  job.status === 'completed' ? 'bg-success-soft text-success' : '',
                  job.status === 'failed' ? 'bg-danger-soft text-danger' : '',
                  job.status === 'cancelled' ? 'bg-border text-text-subtle' : '',
                  job.status === 'running' ? 'bg-info-soft text-info' : '',
                  job.status === 'queued' ? 'bg-border text-text-subtle' : '',
                ]"
              >{{ job.status }}</span>
            </button>
            <p v-if="job.status === 'completed'" data-testid="job-outcome" class="m-0 mt-1 text-sm text-success">
              Answer: {{ answerPreviewForJob(job) ?? "shown in chat" }}. Select this job to jump to it.
            </p>
            <p v-else-if="job.status === 'cancelled'" data-testid="job-outcome" class="m-0 mt-1 text-sm text-muted">Research canceled.</p>
            <p v-else-if="job.status === 'queued' || job.status === 'running'" class="m-0 mt-1 text-sm text-info">{{ jobPhase(job) }} for {{ formatElapsedSince(job.created_at) }}.</p>
            <div v-if="job.error_message && job.status !== 'cancelled'">
              <p class="m-0 mt-1 text-sm text-danger">{{ friendlyFailure(job) }}</p>
              <details class="mt-1.5 text-xs text-muted">
                <summary class="cursor-pointer py-1 font-semibold text-text-subtle">Technical details</summary>
                <p class="m-0 mt-1.5 [overflow-wrap:anywhere]">{{ job.error_message }}</p>
              </details>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">No research jobs yet.</p>
      </aside>
    </main>

    <div v-if="error" data-testid="error-banner" class="mt-4 rounded-md bg-danger-soft p-3 text-danger" role="alert">{{ error }}</div>
  </div>
</template>
