<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { Answer, AnswerResult, ResearchJob } from "@affordance-atlas/domain";
import type { ChatMessage } from "../composables/useAffordanceAgent.js";

const props = defineProps<{
  connected: boolean;
  connecting: boolean;
  busy: boolean;
  working: boolean;
  messages: ChatMessage[];
  jobs: ResearchJob[];
  ask: (query: string) => Promise<void>;
  cancelResearchJob: (jobId: ResearchJob["job_id"]) => Promise<void>;
}>();

const input = ref("");
const messagesEl = ref<HTMLDivElement | null>(null);
const nowMs = ref(Date.now());
const highlightedJobId = ref<string | null>(null);

const canSend = computed(() => props.connected && !props.busy && !props.working && input.value.trim().length > 0);
const hasMessages = computed(() => props.messages.length > 0);
const activeJobs = computed(() => props.jobs.filter((job) => job.status === "queued" || job.status === "running"));
const primaryActiveJob = computed(() => activeJobs.value[0] ?? null);
const inputPlaceholder = computed(() => {
  if (!props.connected) return "Connect before asking...";
  if (props.working) return "Research is running. Cancel it or start a new chat to ask something else.";
  return "Ask when and where something is available...";
});
const sendLabel = computed(() => {
  if (props.working) return "Researching";
  if (props.busy) return "Sending";
  return "Ask";
});

type ResultQuality = { unverified: boolean; problems: string[]; safePlace: string | null; safeWhen: string | null; confidenceLabel: string };
type FailedResearchShell = { job: ResearchJob; sourcesTried: string[]; caveats: string[] };

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
  if (!safePlace || looksLikeDomain(safePlace) || looksLikeNavigationText(safePlace)) problems.push("Place was not verified from the extracted source text.");
  if (!safeWhen || looksLikeDomain(safeWhen) || looksLikeNavigationText(safeWhen) || !hasScheduleSignal(safeWhen)) problems.push("Schedule/time was not verified from the extracted source text.");
  if (result.confidence_state === "candidate" || result.verification_state === "candidate") problems.push("The extracted result is only an unverified lead.");
  return { unverified: problems.length > 0, problems: [...new Set(problems)], safePlace: problems.some((problem) => problem.startsWith("Place")) ? null : safePlace, safeWhen: problems.some((problem) => problem.startsWith("Schedule")) ? null : safeWhen, confidenceLabel: confidenceLabel(result.confidence_state) };
}
function answerHasOnlyUnverifiedResults(answer: Answer): boolean { return answer.results.length > 0 && answer.results.every((result) => resultQuality(result).unverified); }
function answerLead(answer: Answer): string { return answerHasOnlyUnverifiedResults(answer) ? "I found a possible source but could not verify the schedule." : answer.answer_summary; }
function formatTime(iso: string): string { try { return new Date(iso).toLocaleTimeString(); } catch { return ""; } }
function formatDateTime(iso: string): string { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
function formatElapsedSince(iso: string): string { const startMs = new Date(iso).getTime(); if (!Number.isFinite(startMs)) return ""; const totalSeconds = Math.max(0, Math.floor((nowMs.value - startMs) / 1000)); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`; }
function jobPhase(job: ResearchJob): string { if (job.status === "queued") return "Queued for research"; if (job.status === "running") return "Checking sources"; if (job.status === "completed") return "Completed"; if (job.status === "cancelled") return "Canceled"; return "Needs review"; }
function friendlyFailure(job: ResearchJob): string { return job.status === "cancelled" ? "Research was canceled before Atlas completed an answer." : `Atlas could not verify a reliable answer for "${job.query_snapshot.original_user_query}" from accessible sources.`; }
function messageKey(msg: ChatMessage, idx: number): string { return `${msg.role}-${msg.createdAt}-${idx}`; }
function messageDomId(idx: number): string { return `message-${idx}`; }
function extractSourceUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  const urls = value.match(/https?:\/\/[^\s|)]+/gi) ?? [];
  return [...new Set(urls.map((url) => url.replace(/[.,;:]+$/g, "")))].slice(0, 10);
}
function failureMessageForJob(job: ResearchJob): string {
  return `I couldn't verify a reliable answer for "${job.query_snapshot.original_user_query}" from the accessible sources. Check the job details for the technical reason.`;
}
function failedJobMatchesMessage(job: ResearchJob, msg: ChatMessage): boolean {
  const query = job.query_snapshot.original_user_query;
  return msg.content === failureMessageForJob(job) || msg.content.includes(`"${query}"`);
}
function failedResearchShell(msg: ChatMessage): FailedResearchShell | null {
  if (msg.role !== "assistant" || msg.answer) return null;
  const failedJobs = props.jobs
    .filter((job) => job.status === "failed" && failedJobMatchesMessage(job, msg))
    .sort((left, right) => Date.parse(right.completed_at ?? right.updated_at) - Date.parse(left.completed_at ?? left.updated_at));
  const failedJob = failedJobs.find((job) => msg.content === failureMessageForJob(job)) ?? failedJobs[0];
  if (!failedJob) return null;
  return {
    job: failedJob,
    sourcesTried: extractSourceUrls(failedJob.error_message),
    caveats: [
      "Atlas did not verify a supported place and time from accessible source text.",
      "Source access, relevance checks, or extraction may have failed before a reliable answer could be built.",
      "Do not rely on this as an availability answer without checking an official source directly.",
    ],
  };
}
function reportIssueHref(job: ResearchJob): string {
  const subject = `Affordance Atlas research failure: ${job.job_id}`;
  const body = [
    `Job ID: ${job.job_id}`,
    `Query: ${job.query_snapshot.original_user_query}`,
    `Status: ${job.status}`,
    `Error: ${job.error_message ?? "No error message available."}`,
  ].join("\n");
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function findMessageIndexForJob(job: ResearchJob): number {
  if (job.result_answer_id) {
    const answerIndex = props.messages.findIndex((message) => message.role === "assistant" && message.answer?.answer_id === job.result_answer_id);
    if (answerIndex >= 0) return answerIndex;
  }
  const query = job.query_snapshot.original_user_query;
  if (job.status === "failed") {
    const failedIndex = props.messages.findIndex((message) => message.role === "assistant" && message.content.includes(query));
    if (failedIndex >= 0) return failedIndex;
  }
  return props.messages.findIndex((message) => message.role === "user" && message.content === query);
}
function answerPreviewForJob(job: ResearchJob): string | null {
  if (!job.result_answer_id) return null;
  const message = props.messages.find((item): item is Extract<ChatMessage, { role: "assistant" }> => item.role === "assistant" && item.answer?.answer_id === job.result_answer_id);
  const summary = message?.answer ? answerLead(message.answer) : null;
  return summary ? (summary.length > 120 ? `${summary.slice(0, 120)}...` : summary) : null;
}
function focusJob(job: ResearchJob): void {
  highlightedJobId.value = job.job_id;
  const messageIndex = findMessageIndexForJob(job);
  const target = messageIndex >= 0 ? document.getElementById(messageDomId(messageIndex)) : document.querySelector(`[data-job-id="${job.job_id}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => { if (highlightedJobId.value === job.job_id) highlightedJobId.value = null; }, 1800);
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
async function handleSubmit() {
  const query = input.value.trim();
  if (!query || !canSend.value) return;
  input.value = "";
  await props.ask(query);
}
function askExample(query: string) { input.value = query; void handleSubmit(); }
async function handleCancelActiveJob(): Promise<void> { const job = primaryActiveJob.value; if (!job) return; await props.cancelResearchJob(job.job_id); }
function applyChatVisualFixture(fixture: { input?: string; highlightedJobId?: string | null }): void {
  if (fixture.input !== undefined) input.value = fixture.input;
  if (fixture.highlightedJobId !== undefined) highlightedJobId.value = fixture.highlightedJobId;
}

const exampleQueries = ["When can I visit the Statue of Liberty National Monument this week?", "What time is Sunday Mass at St. Patrick's Cathedral in New York?", "When is the Union Square Greenmarket open in Manhattan?"];

let clockTimer: ReturnType<typeof window.setInterval> | null = null;
onMounted(() => { clockTimer = window.setInterval(() => { nowMs.value = Date.now(); }, 1000); });
onUnmounted(() => { if (clockTimer !== null) window.clearInterval(clockTimer); });
watch(() => props.messages, () => { void nextTick(scrollToBottom); }, { deep: true });
defineExpose({ applyChatVisualFixture });
</script>

<template>
  <main class="grid grid-cols-[1fr_280px] gap-4 max-md:grid-cols-1 max-md:gap-3">
    <section class="flex min-h-0 flex-col gap-3 max-md:min-h-auto" aria-label="Chat">
      <div ref="messagesEl" data-testid="messages-container" class="flex max-h-[min(72vh,46rem)] flex-col gap-3 overflow-y-auto p-1 max-md:p-0" aria-live="polite" aria-relevant="additions text">
        <div v-if="!hasMessages" class="px-4 py-5 text-center text-text-subtle max-md:px-1 max-md:py-3">
          <h2 class="m-0 mb-3 text-lg">Ask when and where something is available</h2>
          <p class="text-sm text-muted">Live research examples; Atlas will verify sources before answering.</p>
          <ul class="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            <li v-for="q in exampleQueries" :key="q"><button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-full border border-info-border bg-primary-soft px-3 py-2 text-sm text-info hover:bg-info-soft" @click="askExample(q)">{{ q }}</button></li>
          </ul>
        </div>
        <div v-for="(msg, idx) in messages" :id="messageDomId(idx)" :key="messageKey(msg, idx)" :data-testid="`message-${msg.role}`" :class="['flex', msg.role === 'user' ? 'justify-end' : '']">
          <div class="max-w-[80%] rounded-lg px-4 py-3 max-md:max-w-full" :class="msg.role === 'user' ? 'bg-primary text-primary-text' : msg.role === 'system' ? 'bg-info-muted text-info' : 'bg-surface-muted'">
            <div class="mb-1 flex justify-between gap-4 text-xs opacity-70"><strong>{{ msg.role === "user" ? "You" : msg.role === "assistant" ? "Atlas" : "System" }}</strong><time v-if="msg.createdAt">{{ formatTime(msg.createdAt) }}</time></div>
            <template v-if="msg.role === 'assistant' && msg.answer">
              <p :class="['m-0 mt-1 mb-2 text-base', answerHasOnlyUnverifiedResults(msg.answer) ? 'font-bold text-warning' : '']">{{ answerLead(msg.answer) }}</p>
              <section v-for="result in msg.answer.results" :key="result.result_id" data-testid="answer-result" :class="['mt-2 grid gap-2 border-t border-border-strong pt-2', resultQuality(result).unverified ? 'border-warning-border' : '']">
                <div v-if="resultQuality(result).unverified" class="rounded-md border border-warning-border bg-warning-soft p-2 text-warning-strong" role="status"><div class="flex flex-wrap items-baseline gap-x-2 gap-y-1"><strong>{{ resultQuality(result).confidenceLabel }}</strong><span class="text-xs">Source found; schedule not verified.</span></div><ul class="m-0 mt-1 pl-4 text-xs"><li v-for="problem in resultQuality(result).problems" :key="problem">{{ problem }}</li></ul></div>
                <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2 max-md:grid-cols-1"><div class="grid gap-0.5"><span class="text-xs font-bold uppercase tracking-[0.04em] text-muted">Place</span><strong>{{ resultQuality(result).safePlace ?? "Not verified" }}</strong><span v-if="result.place_address && resultQuality(result).safePlace" class="text-sm text-muted">{{ result.place_address }}</span></div><div class="grid gap-0.5"><span class="text-xs font-bold uppercase tracking-[0.04em] text-muted">Available for</span><strong>{{ result.affordance_label }}</strong></div><div class="grid gap-0.5"><span class="text-xs font-bold uppercase tracking-[0.04em] text-muted">When</span><strong class="font-medium text-info">{{ resultQuality(result).safeWhen ?? "Not verified" }}</strong></div><div class="grid gap-0.5"><span class="text-xs font-bold uppercase tracking-[0.04em] text-muted">Confidence:</span><strong>{{ resultQuality(result).confidenceLabel }}</strong></div></div>
                <details class="border-t border-border pt-2 text-sm"><summary class="cursor-pointer py-1 font-semibold text-text-subtle">Sources and evidence ({{ result.evidence.length }})</summary><div v-for="item in result.evidence" :key="item.evidence_item_id" data-testid="answer-evidence" class="grid gap-1.5 border-y border-border py-2 text-sm"><div class="grid gap-0.5"><span class="text-xs font-bold uppercase tracking-[0.04em] text-muted">Source</span><a data-testid="answer-source-link" :href="item.source_url" target="_blank" rel="noreferrer" class="text-primary-strong [overflow-wrap:anywhere] hover:underline focus-visible:underline">{{ item.source_title || item.source_url }}</a><span class="text-sm text-muted">Retrieved {{ formatDateTime(item.retrieved_at) }}</span></div><p v-if="item.evidence_span" class="m-0 text-text-subtle">{{ item.evidence_span }}</p><p class="m-0 text-text">{{ item.extracted_text }}</p></div></details>
                <details v-if="result.caveats.length > 0" class="border-t border-border pt-2 text-sm"><summary class="cursor-pointer py-1 font-semibold text-text-subtle">Caveats</summary><p class="mt-2 text-sm text-warning">{{ result.caveats.join(" ") }}</p></details>
              </section>
              <p v-if="msg.answer.next_actions.length > 0" class="mt-2 text-sm text-text-subtle">Next: {{ msg.answer.next_actions.map((a) => a.label).join("; ") }}</p>
            </template>
            <section v-else-if="failedResearchShell(msg)" data-testid="partial-answer-shell" class="grid gap-3" role="status">
              <div class="grid gap-1">
                <p class="m-0 font-bold text-warning">I couldn't produce a reliable answer.</p>
                <p class="m-0 [overflow-wrap:anywhere] text-text-subtle">{{ msg.content }}</p>
              </div>
              <div class="rounded-md border border-warning-border bg-warning-soft p-2 text-warning-strong">
                <strong>Partial answer shell</strong>
                <p class="m-0 mt-1 text-sm">Atlas tried to research "{{ failedResearchShell(msg)?.job.query_snapshot.original_user_query }}" but could not verify a supported schedule or availability result.</p>
                <ul class="m-0 mt-1 pl-4 text-xs">
                  <li v-for="caveat in failedResearchShell(msg)?.caveats" :key="caveat">{{ caveat }}</li>
                </ul>
              </div>
              <details v-if="failedResearchShell(msg)?.sourcesTried.length" class="border-t border-border pt-2 text-sm">
                <summary class="cursor-pointer py-1 font-semibold text-text-subtle">Sources tried ({{ failedResearchShell(msg)?.sourcesTried.length }})</summary>
                <ul class="m-0 mt-1 grid list-none gap-1 p-0">
                  <li v-for="source in failedResearchShell(msg)?.sourcesTried" :key="source">
                    <a :href="source" target="_blank" rel="noreferrer" class="text-primary-strong [overflow-wrap:anywhere] hover:underline focus-visible:underline">{{ source }}</a>
                  </li>
                </ul>
              </details>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-warning-border bg-surface px-3 py-2 text-sm text-warning-strong hover:bg-warning-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted" :disabled="busy || working" @click="ask(failedResearchShell(msg)?.job.query_snapshot.original_user_query ?? '')">Retry</button>
                <a :href="reportIssueHref(failedResearchShell(msg)!.job)" class="inline-flex items-center justify-center rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text hover:bg-surface-muted">Report issue</a>
              </div>
            </section>
            <p v-else class="m-0 [overflow-wrap:anywhere]">{{ msg.content }}</p>
          </div>
        </div>
        <div v-if="primaryActiveJob" data-testid="working-indicator" class="flex" role="status" aria-live="polite"><div class="max-w-[80%] rounded-lg bg-info-muted px-4 py-3 text-info max-md:max-w-full"><div class="mb-1 flex justify-between gap-4 text-xs opacity-70"><strong>Atlas</strong><time>{{ formatElapsedSince(primaryActiveJob.created_at) }}</time></div><div class="grid gap-1"><strong>{{ jobPhase(primaryActiveJob) }}</strong><p class="m-0 text-text-subtle">{{ primaryActiveJob.query_snapshot.original_user_query }}</p><small class="text-info">Research can take a minute when Atlas has to verify live sources.</small></div><div class="mt-3 flex flex-wrap gap-2"><button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-info-border bg-surface px-3 py-2 text-sm text-info hover:bg-info-muted" @click="focusJob(primaryActiveJob)">View activity</button><button type="button" class="inline-flex cursor-pointer items-center justify-center rounded-md border border-info-border bg-surface px-3 py-2 text-sm text-info hover:bg-info-muted" @click="handleCancelActiveJob">Cancel research</button></div></div></div>
      </div>
      <form class="grid grid-cols-[1fr_auto] gap-2 max-md:grid-cols-1" @submit.prevent="handleSubmit"><input v-model="input" data-testid="chat-input" type="text" :placeholder="inputPlaceholder" :disabled="!connected || busy || working" class="rounded-md border border-border-strong p-3" /><button data-testid="send-button" class="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-primary px-3 py-2 text-sm text-primary-text disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted" type="submit" :disabled="!canSend">{{ sendLabel }}</button></form>
    </section>
    <aside class="self-start rounded-md bg-surface-subtle p-3 shadow-panel max-md:rounded-none max-md:border-t max-md:border-border max-md:bg-transparent max-md:px-0 max-md:pb-0 max-md:pt-2 max-md:shadow-none" aria-label="Research jobs">
      <div class="mb-2 flex items-baseline justify-between gap-2 max-md:mb-1.5"><h2 class="m-0 text-sm">Activity</h2><span v-if="activeJobs.length > 0" class="text-xs text-info">{{ activeJobs.length }} active</span></div>
      <ul v-if="jobs.length > 0" class="m-0 flex list-none flex-col gap-2 p-0 max-md:gap-1.5"><li v-for="job in jobs" :key="job.job_id" :data-job-id="job.job_id" data-testid="job-list-item" :class="['rounded-md bg-surface p-2 shadow-card transition-shadow max-md:px-2 max-md:py-2', highlightedJobId === job.job_id ? '[box-shadow:var(--focus-ring),var(--shadow-card)]' : '']"><button type="button" class="block w-full cursor-pointer border-0 bg-transparent p-0 text-left text-inherit" @click="focusJob(job)"><span class="flex flex-wrap items-start justify-between gap-x-2 gap-y-1"><strong class="hover:underline">{{ jobPhase(job) }}</strong><span data-testid="job-status-badge" :class="['rounded-sm px-1.5 py-0.5 text-xs uppercase', job.status === 'completed' ? 'bg-success-soft text-success' : '', job.status === 'failed' ? 'bg-danger-soft text-danger' : '', job.status === 'cancelled' ? 'bg-border text-text-subtle' : '', job.status === 'running' ? 'bg-info-soft text-info' : '', job.status === 'queued' ? 'bg-border text-text-subtle' : '']">{{ job.status }}</span></span><span class="mt-1 block text-sm text-text-subtle">{{ job.query_snapshot.original_user_query }}</span></button><p v-if="job.status === 'completed'" data-testid="job-outcome" class="m-0 mt-1 text-sm text-success">Answer: {{ answerPreviewForJob(job) ?? "shown in chat" }}. Select this job to jump to it.</p><p v-else-if="job.status === 'cancelled'" data-testid="job-outcome" class="m-0 mt-1 text-sm text-muted">Research canceled.</p><p v-else-if="job.status === 'queued' || job.status === 'running'" class="m-0 mt-1 text-sm text-info">{{ formatElapsedSince(job.created_at) }} elapsed.</p><div v-if="job.error_message && job.status !== 'cancelled'"><p class="m-0 mt-1 text-sm text-danger">{{ friendlyFailure(job) }}</p><details class="mt-1.5 border-t border-border pt-1.5 text-xs text-muted"><summary class="cursor-pointer py-1 font-semibold text-text-subtle">Technical details</summary><div class="mt-1.5 grid gap-1"><p class="m-0"><strong>Job ID:</strong> <span class="[overflow-wrap:anywhere]">{{ job.job_id }}</span></p><p class="m-0 [overflow-wrap:anywhere]">{{ job.error_message }}</p></div></details></div><details v-else class="mt-1.5 border-t border-border pt-1.5 text-xs text-muted"><summary class="cursor-pointer py-1 font-semibold text-text-subtle">Job diagnostics</summary><div class="mt-1.5 grid gap-1"><p class="m-0"><strong>Job ID:</strong> <span class="[overflow-wrap:anywhere]">{{ job.job_id }}</span></p><p class="m-0">Updated {{ formatDateTime(job.updated_at) }}</p></div></details></li></ul>
      <p v-else class="text-sm text-muted">No research jobs yet.</p>
    </aside>
  </main>
</template>
