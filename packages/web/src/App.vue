<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useAffordanceAgent } from "./composables/useAffordanceAgent.js";

const { connected, connecting, error, messages, jobs, busy, working, ask } = useAffordanceAgent();

const input = ref("");
const demoMode = ref(false);
const messagesEl = ref<HTMLDivElement | null>(null);

const canSend = computed(() => connected.value && !busy.value && input.value.trim().length > 0);
const hasMessages = computed(() => messages.value.length > 0);

async function handleSubmit() {
  const query = input.value.trim();
  if (!query || !canSend.value) return;
  input.value = "";
  await ask(query, demoMode.value ? "demo" : undefined);
}

function askExample(query: string) {
  input.value = query;
  void handleSubmit();
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return "";
  }
}

function messageKey(msg: typeof messages.value[number], idx: number): string {
  return `${msg.role}-${msg.createdAt}-${idx}`;
}

function scrollToBottom() {
  const el = messagesEl.value;
  if (!el) return;
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
  "Where can I go to Mass in Clifton Park on Sunday?",
  "What time is the farmers market in Troy?",
  "Is there a yoga class in Albany tonight?",
];
</script>

<template>
    <div class="app">
      <header>
        <h1>Affordance Atlas</h1>
        <div class="header-actions">
          <label data-testid="demo-mode-toggle" class="demo-toggle" title="Return an instant sample answer instead of researching">
            <input v-model="demoMode" type="checkbox" />
            Demo mode
          </label>
          <span data-testid="connection-status" :class="['status', connected ? 'online' : 'offline']">
            {{ connecting ? "Connecting..." : connected ? "Online" : "Offline" }}
          </span>
        </div>
      </header>

      <main>
        <section class="chat" aria-label="Chat">
          <div ref="messagesEl" data-testid="messages-container" class="messages">
          <div v-if="!hasMessages" class="empty-state">
            <h2>Ask when and where something is available</h2>
            <p class="muted">Examples:</p>
            <ul class="examples">
              <li v-for="q in exampleQueries" :key="q">
                <button type="button" @click="askExample(q)">{{ q }}</button>
              </li>
            </ul>
          </div>

          <div
            v-for="(msg, idx) in messages"
            :key="messageKey(msg, idx)"
            :data-testid="`message-${msg.role}`"
            :class="['message', msg.role]"
          >
            <div class="bubble">
              <div class="meta">
                <strong>{{ msg.role === "user" ? "You" : msg.role === "assistant" ? "Atlas" : "System" }}</strong>
                <time v-if="msg.createdAt">{{ formatTime(msg.createdAt) }}</time>
              </div>
              <p>{{ msg.content }}</p>
              <div v-if="msg.role === 'assistant' && msg.answer" class="answer">
                <div v-if="msg.answer.results.length > 0" class="results">
                  <article v-for="result in msg.answer.results" :key="result.result_id" class="result-card">
                    <h3>{{ result.place_label }}</h3>
                    <p v-if="result.place_address" class="muted">{{ result.place_address }}</p>
                    <p>{{ result.affordance_label }}</p>
                    <p v-if="result.occurrence.recurrence_label" class="recurrence">{{ result.occurrence.recurrence_label }}</p>
                    <p v-if="result.caveats.length > 0" class="caveats">{{ result.caveats.join(" ") }}</p>
                  </article>
                </div>
                <p v-if="msg.answer.next_actions.length > 0" class="next-actions">
                  Next: {{ msg.answer.next_actions.map((a) => a.label).join("; ") }}
                </p>
              </div>
            </div>
          </div>

          <div v-if="working" data-testid="working-indicator" class="message system">
            <div class="bubble">
              <div class="meta">
                <strong>Atlas</strong>
              </div>
              <p class="typing">
                <span class="dot" /><span class="dot" /><span class="dot" />
              </p>
            </div>
          </div>
        </div>

        <form class="input-row" @submit.prevent="handleSubmit">
            <input
              v-model="input"
              data-testid="chat-input"
              type="text"
              placeholder="Ask when and where something is available..."
              :disabled="!connected || busy"
            />
            <button data-testid="send-button" type="submit" :disabled="!canSend">
            {{ busy ? "..." : "Ask" }}
          </button>
        </form>
      </section>

      <aside class="jobs" aria-label="Research jobs">
        <h2>Session Jobs</h2>
        <ul v-if="jobs.length > 0">
          <li
            v-for="job in jobs"
            :key="job.job_id"
            data-testid="job-list-item"
            :class="['job', job.status]"
          >
            <strong>{{ job.query_snapshot.original_user_query }}</strong>
            <span data-testid="job-status-badge" class="badge">{{ job.status }}</span>
            <p v-if="job.error_message" class="error-text">{{ job.error_message }}</p>
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
  min-height: 60vh;
}
.messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  max-height: 60vh;
  padding: 0.25rem;
}
.empty-state {
  text-align: center;
  padding: 2rem;
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
.demo-toggle {
  font-size: 0.875rem;
  color: #4b5563;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}
.demo-toggle input {
  cursor: pointer;
}
.jobs {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 0.75rem;
  align-self: start;
}
.jobs h2 {
  margin-top: 0;
  font-size: 1rem;
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
.job.running .badge {
  background: #dbeafe;
  color: #1e40af;
}
.result-card {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: white;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}
.result-card h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}
.muted {
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
.typing {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  margin: 0;
  height: 1.25rem;
}
.dot {
  width: 0.5rem;
  height: 0.5rem;
  background: #9ca3af;
  border-radius: 50%;
  animation: bounce 1s infinite ease-in-out;
}
.dot:nth-child(2) {
  animation-delay: 0.15s;
}
.dot:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes bounce {
  0%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-0.25rem);
  }
}
@media (max-width: 768px) {
  main {
    grid-template-columns: 1fr;
  }
  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
