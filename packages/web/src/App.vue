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
    <div :class="['app', isAdminPage ? 'admin-shell' : '']">
      <header>
        <h1>Affordance Atlas</h1>
        <div class="header-actions">
          <a v-if="isAdminPage" class="secondary-button" href="/">
            Back to app
          </a>
          <button v-if="!isAdminPage" data-testid="new-chat-button" class="secondary-button" type="button" @click="handleNewChat">
            New chat
          </button>
          <span data-testid="connection-status" :class="['status', connected ? 'online' : 'offline']">
            {{ connecting ? "Connecting..." : connected ? "Online" : "Offline" }}
          </span>
        </div>
      </header>

      <section v-if="isAdminPage" class="admin-page" aria-label="Admin">
        <div class="admin-panel">
          <div class="admin-heading">
            <h2>Admin</h2>
            <p class="muted">Enter the admin bearer token to unlock operational status.</p>
          </div>

          <form v-if="!adminAuthenticated" class="admin-token-form" @submit.prevent="validateAdminToken()">
            <label for="admin-token">Bearer token</label>
            <input
              id="admin-token"
              v-model="adminTokenInput"
              data-testid="admin-token-input"
              type="password"
              autocomplete="current-password"
              placeholder="Paste admin bearer token"
            />
            <button data-testid="admin-token-submit" type="submit" :disabled="adminLoading || adminTokenInput.trim().length === 0">
              {{ adminLoading ? "Verifying..." : "Unlock admin" }}
            </button>
          </form>

          <div v-else class="admin-authenticated">
            <div class="admin-token-row">
              <div>
                <p class="label">Saved bearer token</p>
                <code data-testid="admin-token-mask">{{ "*".repeat(Math.min(savedAdminToken.length, 24)) }}</code>
              </div>
              <div class="admin-actions">
                <button type="button" @click="copyAdminToken('raw')">Copy token</button>
                <button type="button" @click="copyAdminToken('bearer')">Copy header</button>
                <button type="button" @click="clearAdminToken">Forget token</button>
              </div>
            </div>
            <p v-if="adminCopyMessage" data-testid="admin-copy-message" class="muted">{{ adminCopyMessage }}</p>

            <div class="admin-summary" data-testid="admin-summary">
              <div>
                <h3>Research Jobs</h3>
                <p class="muted">Updated {{ adminSummary ? formatDateTime(adminSummary.generated_at) : "" }}</p>
              </div>
              <div class="status-grid">
                <div v-for="row in adminSummary?.status_counts ?? []" :key="row.status" class="status-card">
                  <span>{{ row.status }}</span>
                  <strong>{{ row.count }}</strong>
                </div>
              </div>
              <details class="recent-jobs">
                <summary>Recent Jobs</summary>
                <ol v-if="adminSummary && adminSummary.recent_jobs.length > 0">
                  <li v-for="job in adminSummary.recent_jobs" :key="job.research_job_id">
                    <strong>{{ job.status }}</strong>
                    <span>{{ job.original_user_query }}</span>
                    <small>{{ formatDateTime(job.created_at) }}</small>
                    <p v-if="job.error_message" class="error-text">{{ job.error_message }}</p>
                  </li>
                </ol>
                <p v-else class="muted">No jobs found.</p>
              </details>

              <div class="admin-table-explorer" data-testid="admin-table-explorer">
                <div class="admin-table-header">
                  <div>
                    <h3>Data Tables</h3>
                    <p class="muted">Browse allowlisted D1 tables.</p>
                  </div>
                  <button type="button" :disabled="adminTableLoading" @click="loadAdminTableRows()">
                    {{ adminTableLoading ? "Loading..." : "Refresh" }}
                  </button>
                </div>

                <div class="admin-table-tabs" role="tablist" aria-label="Admin data tables">
                  <button
                    v-for="table in adminTables"
                    :key="table.name"
                    type="button"
                    role="tab"
                    :aria-selected="selectedAdminTable === table.name"
                    :class="['admin-table-tab', selectedAdminTable === table.name ? 'active' : '']"
                    @click="selectAdminTable(table.name)"
                  >
                    <span>{{ table.label }}</span>
                    <small>{{ table.count }}</small>
                  </button>
                </div>

                <div v-if="adminTableRows" class="admin-table-meta">
                  <span>{{ adminTableRows.table.label }}</span>
                  <span>{{ adminTableRows.offset + 1 }}-{{ Math.min(adminTableRows.offset + adminTableRows.rows.length, adminTableRows.table.count) }} of {{ adminTableRows.table.count }}</span>
                  <div class="admin-table-pager">
                    <button type="button" :disabled="!canPageAdminBack || adminTableLoading" @click="pageAdminTable('previous')">Previous</button>
                    <button type="button" :disabled="!canPageAdminForward || adminTableLoading" @click="pageAdminTable('next')">Next</button>
                  </div>
                </div>

                <div class="admin-table-wrap">
                  <table v-if="adminTableRows && adminTableRows.rows.length > 0" data-testid="admin-data-table" class="admin-data-table">
                    <thead>
                      <tr>
                        <th v-for="column in selectedAdminColumns" :key="column">{{ column }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, rowIndex) in adminTableRows.rows" :key="rowIndex">
                        <td v-for="column in selectedAdminColumns" :key="column">
                          <span class="cell-value" :title="formatCellValue(row[column])">{{ formatCellValue(row[column]) }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p v-else class="muted">No rows for this table.</p>
                </div>
              </div>
            </div>
          </div>

          <p v-if="adminError" data-testid="admin-error" class="error-text">{{ adminError }}</p>
        </div>
      </section>

      <main v-else>
        <section :class="['chat', hasMessages ? 'has-messages' : 'is-empty']" aria-label="Chat">
          <div ref="messagesEl" data-testid="messages-container" class="messages" aria-live="polite" aria-relevant="additions text">
          <div v-if="!hasMessages" class="empty-state">
            <h2>Ask when and where something is available</h2>
            <p class="muted">Live research examples; Atlas will verify sources before answering.</p>
            <ul class="examples">
              <li v-for="q in exampleQueries" :key="q">
                <button type="button" @click="askExample(q)">{{ q }}</button>
              </li>
            </ul>
          </div>

          <div
            v-for="(msg, idx) in messages"
            :id="messageDomId(idx)"
            :key="messageKey(msg, idx)"
            :data-testid="`message-${msg.role}`"
            :class="['message', msg.role]"
          >
            <div class="bubble">
              <div class="meta">
                <strong>{{ msg.role === "user" ? "You" : msg.role === "assistant" ? "Atlas" : "System" }}</strong>
                <time v-if="msg.createdAt">{{ formatTime(msg.createdAt) }}</time>
              </div>
              <template v-if="msg.role === 'assistant' && msg.answer">
                <p :class="['answer-lede', answerHasOnlyUnverifiedResults(msg.answer) ? 'unverified' : '']">{{ answerLead(msg.answer) }}</p>
                <div v-if="answerHasOnlyUnverifiedResults(msg.answer)" class="unverified-answer-alert" role="status">
                  <strong>Unverified lead</strong>
                  <p>The source may be relevant, but Atlas could not verify the place and schedule fields well enough to present this as an answer.</p>
                </div>
                <section
                  v-for="result in msg.answer.results"
                  :key="result.result_id"
                  data-testid="answer-result"
                  :class="['answer-flat', resultQuality(result).unverified ? 'unverified-result' : '']"
                >
                  <div v-if="resultQuality(result).unverified" class="result-warning">
                    <strong>{{ resultQuality(result).confidenceLabel }}</strong>
                    <ul>
                      <li v-for="problem in resultQuality(result).problems" :key="problem">{{ problem }}</li>
                    </ul>
                  </div>

                  <div class="answer-facts">
                    <div>
                      <span class="fact-label">Place</span>
                      <strong>{{ resultQuality(result).safePlace ?? "Not verified" }}</strong>
                      <span v-if="result.place_address && resultQuality(result).safePlace" class="fact-detail">{{ result.place_address }}</span>
                    </div>
                    <div>
                      <span class="fact-label">Available for</span>
                      <strong>{{ result.affordance_label }}</strong>
                    </div>
                    <div>
                      <span class="fact-label">When</span>
                      <strong class="recurrence">{{ resultQuality(result).safeWhen ?? "Not verified" }}</strong>
                    </div>
                    <div>
                      <span class="fact-label">Confidence:</span>
                      <strong>{{ resultQuality(result).confidenceLabel }}</strong>
                    </div>
                  </div>

                  <details class="evidence-details">
                    <summary>Sources and evidence ({{ result.evidence.length }})</summary>
                    <div v-for="item in result.evidence" :key="item.evidence_item_id" data-testid="answer-evidence" class="evidence-row">
                      <div>
                        <span class="fact-label">Source</span>
                        <a data-testid="answer-source-link" :href="item.source_url" target="_blank" rel="noreferrer">{{ item.source_title || item.source_url }}</a>
                        <span class="fact-detail">Retrieved {{ formatDateTime(item.retrieved_at) }}</span>
                      </div>
                      <p v-if="item.evidence_span" class="evidence-span">{{ item.evidence_span }}</p>
                      <p class="evidence-text">{{ item.extracted_text }}</p>
                    </div>
                  </details>

                  <details v-if="result.caveats.length > 0" class="caveat-details">
                    <summary>Caveats</summary>
                    <p class="caveats">{{ result.caveats.join(" ") }}</p>
                  </details>
                </section>
                <p v-if="msg.answer.next_actions.length > 0" class="next-actions">
                  Next: {{ msg.answer.next_actions.map((a) => a.label).join("; ") }}
                </p>
              </template>
              <p v-else>{{ msg.content }}</p>
            </div>
          </div>

          <div v-if="primaryActiveJob" data-testid="working-indicator" class="message system active-research" role="status" aria-live="polite">
            <div class="bubble">
              <div class="meta">
                <strong>Atlas</strong>
                <time>{{ formatElapsedSince(primaryActiveJob.created_at) }}</time>
              </div>
              <div class="research-status">
                <strong>{{ jobPhase(primaryActiveJob) }}</strong>
                <p>{{ primaryActiveJob.query_snapshot.original_user_query }}</p>
                <small>Research can take a minute when Atlas has to verify live sources.</small>
              </div>
              <div class="research-actions">
                <button type="button" @click="focusJob(primaryActiveJob)">View job</button>
                <button type="button" @click="handleCancelActiveJob">Cancel research</button>
              </div>
            </div>
          </div>
        </div>

        <form class="input-row" @submit.prevent="handleSubmit">
            <input
              v-model="input"
              data-testid="chat-input"
              type="text"
              :placeholder="inputPlaceholder"
              :disabled="!connected || busy || working"
            />
            <button data-testid="send-button" type="submit" :disabled="!canSend">
            {{ sendLabel }}
          </button>
        </form>
      </section>

      <aside class="jobs" aria-label="Research jobs">
        <h2>Activity</h2>
        <ul v-if="jobs.length > 0">
          <li
            v-for="job in jobs"
            :key="job.job_id"
            :data-job-id="job.job_id"
            data-testid="job-list-item"
            :class="['job', job.status, highlightedJobId === job.job_id ? 'highlighted' : '']"
          >
            <button type="button" class="job-link" @click="focusJob(job)">
              <strong>{{ job.query_snapshot.original_user_query }}</strong>
              <span data-testid="job-status-badge" class="badge">{{ job.status }}</span>
            </button>
            <p v-if="job.status === 'completed'" data-testid="job-outcome" class="job-outcome">
              Answer: {{ answerPreviewForJob(job) ?? "shown in chat" }}. Select this job to jump to it.
            </p>
            <p v-else-if="job.status === 'cancelled'" data-testid="job-outcome" class="job-outcome">Research canceled.</p>
            <p v-else-if="job.status === 'queued' || job.status === 'running'" class="job-outcome">{{ jobPhase(job) }} for {{ formatElapsedSince(job.created_at) }}.</p>
            <div v-if="job.error_message && job.status !== 'cancelled'" class="job-error">
              <p class="error-text">{{ friendlyFailure(job) }}</p>
              <details>
                <summary>Technical details</summary>
                <p>{{ job.error_message }}</p>
              </details>
            </div>
          </li>
        </ul>
        <p v-else class="muted">No research jobs yet.</p>
      </aside>
    </main>

    <div v-if="error" data-testid="error-banner" class="error-banner" role="alert">{{ error }}</div>
  </div>
</template>

<style scoped>
.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #ffffff;
  color: #111827;
  min-height: 100vh;
}
.app.admin-shell {
  max-width: 1440px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 1rem;
  flex-wrap: wrap;
}
h1 {
  margin: 0;
  font-size: 1.5rem;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.secondary-button {
  text-decoration: none;
  padding: 0.45rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #111827;
  cursor: pointer;
  font-size: 0.875rem;
}
.secondary-button:hover {
  background: #f3f4f6;
}
.admin-page {
  max-width: 1280px;
  margin: 0 auto;
}
.admin-panel {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  background: #f9fafb;
}
.admin-heading h2,
.admin-summary h3 {
  margin: 0;
}
.admin-token-form {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}
.admin-token-form label,
.label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
}
.admin-token-form input {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
}
.admin-token-form button,
.admin-actions button {
  padding: 0.6rem 0.8rem;
  border: none;
  border-radius: 0.5rem;
  background: #111827;
  color: #ffffff;
  cursor: pointer;
}
.admin-token-form button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}
.admin-token-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}
.admin-token-row code {
  display: block;
  margin-top: 0.25rem;
  color: #111827;
}
.admin-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.admin-summary {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.5rem;
}
.status-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: #ffffff;
}
.status-card span,
.recent-jobs small {
  display: block;
  color: #6b7280;
  font-size: 0.8125rem;
}
.status-card strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.25rem;
}
.recent-jobs summary {
  cursor: pointer;
  font-weight: 700;
}
.recent-jobs ol {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
}
.recent-jobs li {
  margin-bottom: 0.75rem;
}
.recent-jobs li > span {
  display: block;
  margin-top: 0.15rem;
}
.admin-table-explorer {
  display: grid;
  gap: 0.75rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}
.admin-table-header,
.admin-table-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.admin-table-header button,
.admin-table-pager button {
  padding: 0.45rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #111827;
  cursor: pointer;
}
.admin-table-header button:disabled,
.admin-table-pager button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.admin-table-tabs {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}
.admin-table-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
  padding: 0.45rem 0.65rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #111827;
  cursor: pointer;
}
.admin-table-tab.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}
.admin-table-tab small {
  color: #6b7280;
}
.admin-table-pager {
  display: flex;
  gap: 0.5rem;
}
.admin-table-wrap {
  width: 100%;
  max-height: min(76vh, 780px);
  overflow-x: auto;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
}
.admin-data-table {
  min-width: max-content;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.8125rem;
  line-height: 1.35;
}
.admin-data-table th,
.admin-data-table td {
  width: 240px;
  min-width: 240px;
  max-width: 360px;
  padding: 0.55rem 0.7rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: top;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.admin-data-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f9fafb;
  font-weight: 600;
  white-space: nowrap;
}
.cell-value {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.status {
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
}
.status.online {
  background: #dcfce7;
  color: #166534;
}
.status.offline {
  background: #fee2e2;
  color: #991b1b;
}
main {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1rem;
}
.chat {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}
.messages {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  max-height: min(72vh, 46rem);
  padding: 0.25rem;
}
.chat.is-empty .messages {
  overflow: visible;
  max-height: none;
  padding-block: 0.5rem;
}
.empty-state {
  text-align: center;
  padding: 1.25rem 1rem;
  color: #374151;
}
.empty-state h2 {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
}
.examples {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.examples button {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 0.5rem 0.75rem;
  border-radius: 9999px;
  cursor: pointer;
  font-size: 0.875rem;
}
.examples button:hover {
  background: #dbeafe;
}
.message {
  display: flex;
}
.message.user {
  justify-content: flex-end;
}
.bubble {
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: #f3f4f6;
}
.message.user .bubble {
  background: #2563eb;
  color: white;
}
.message.system .bubble {
  background: #fef3c7;
  color: #92400e;
}
.active-research .bubble {
  width: min(100%, 34rem);
}
.research-status {
  display: grid;
  gap: 0.25rem;
}
.research-status p {
  margin: 0;
  color: #78350f;
}
.research-status small {
  color: #92400e;
}
.research-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}
.research-actions button {
  border: 1px solid #d97706;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #92400e;
  cursor: pointer;
  padding: 0.45rem 0.7rem;
}
.meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
  opacity: 0.7;
}
.input-row {
  display: flex;
  gap: 0.5rem;
}
.input-row input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
}
.input-row button {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  background: #2563eb;
  color: white;
  cursor: pointer;
}
.input-row button:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}
.jobs {
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 0.5rem;
  align-self: start;
}
.jobs h2 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}
.jobs ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.job {
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.job.highlighted {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px #bfdbfe;
}
.job-link {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.job-link:hover strong {
  text-decoration: underline;
}
.badge {
  font-size: 0.75rem;
  text-transform: uppercase;
  margin-left: 0.5rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: #e5e7eb;
}
.job.completed .badge {
  background: #dcfce7;
  color: #166534;
}
.job.failed .badge {
  background: #fee2e2;
  color: #991b1b;
}
.job.cancelled .badge {
  background: #e5e7eb;
  color: #374151;
}
.job.running .badge {
  background: #dbeafe;
  color: #1e40af;
}
.muted {
  color: #6b7280;
  font-size: 0.875rem;
}
.answer-lede {
  margin: 0.25rem 0 0.75rem;
  font-size: 1rem;
}
.answer-lede.unverified {
  font-weight: 700;
  color: #92400e;
}
.unverified-answer-alert,
.result-warning {
  border: 1px solid #f59e0b;
  border-radius: 0.5rem;
  background: #fffbeb;
  color: #78350f;
  padding: 0.6rem 0.7rem;
}
.unverified-answer-alert p,
.result-warning ul {
  margin: 0.25rem 0 0;
}
.result-warning ul {
  padding-left: 1rem;
}
.unverified-result {
  border-top-color: #f59e0b;
}
.answer-flat {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #d1d5db;
}
.answer-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}
.answer-facts > div,
.evidence-row > div {
  display: grid;
  gap: 0.15rem;
}
.fact-label {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.fact-detail {
  color: #6b7280;
  font-size: 0.875rem;
}
.recurrence {
  color: #1e40af;
  font-weight: 500;
}
.caveats {
  font-size: 0.875rem;
  color: #92400e;
  margin: 0.5rem 0 0;
}
.evidence-details,
.caveat-details {
  border-top: 1px solid #e5e7eb;
  padding-top: 0.5rem;
  font-size: 0.875rem;
}
.evidence-details summary,
.caveat-details summary,
.job-error summary {
  color: #374151;
  cursor: pointer;
  font-weight: 600;
}
.evidence-row {
  display: grid;
  gap: 0.35rem;
  padding: 0.6rem 0;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
}
.evidence-row a {
  color: #1d4ed8;
  overflow-wrap: anywhere;
}
.evidence-span {
  color: #374151;
  margin: 0;
}
.evidence-text {
  margin: 0;
  color: #111827;
}
.next-actions {
  font-size: 0.875rem;
  color: #374151;
  margin-top: 0.5rem;
}
.error-banner {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 0.5rem;
}
.error-text {
  color: #991b1b;
  font-size: 0.875rem;
  margin: 0.25rem 0 0;
}
.job-error details {
  margin-top: 0.35rem;
  color: #6b7280;
  font-size: 0.8125rem;
}
.job-error details p {
  margin: 0.35rem 0 0;
  overflow-wrap: anywhere;
}
.job-outcome {
  color: #166534;
  font-size: 0.875rem;
  margin: 0.25rem 0 0;
}
@media (max-width: 768px) {
  .app {
    padding: 0.75rem;
  }
  header {
    align-items: flex-start;
  }
  main {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  .header-actions {
    width: 100%;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .chat {
    min-height: auto;
  }
  .messages {
    padding: 0;
  }
  .chat.is-empty .messages {
    padding-block: 0;
  }
  .empty-state {
    padding: 0.75rem 0.25rem;
  }
  .bubble {
    max-width: 100%;
  }
  .answer-facts {
    grid-template-columns: 1fr;
  }
  .input-row {
    align-items: stretch;
  }
  .input-row button {
    padding-inline: 1rem;
  }
  .jobs {
    padding: 0.65rem;
    border-radius: 0.5rem;
  }
  .admin-panel {
    padding: 0.75rem;
  }
  .admin-summary {
    gap: 0.75rem;
  }
  .status-grid {
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  }
  .status-card {
    padding: 0.55rem;
  }
  .admin-table-explorer {
    gap: 0.55rem;
    padding-top: 0.75rem;
  }
  .admin-table-tabs {
    gap: 0.35rem;
  }
  .admin-table-tab {
    padding: 0.35rem 0.5rem;
  }
  .admin-table-wrap {
    max-height: 72vh;
  }
}
</style>
