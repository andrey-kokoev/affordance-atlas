import { ref, shallowRef, onMounted, onUnmounted, computed } from "vue";
import { AgentClient } from "agents/client";
import type { Answer, ResearchJob, ResearchJobId } from "@affordance-atlas/domain";

const AGENT_CLASS = "AffordanceAtlasAgent";
const STORAGE_KEY = "affordance-atlas-session-id";

type ServerSessionState = {
  messages: ChatMessage[];
  jobs: ResearchJob[];
};

export type ChatMessage =
  | { role: "user"; content: string; createdAt: string }
  | { role: "assistant"; content: string; answer?: Answer; createdAt: string }
  | { role: "system"; content: string; createdAt: string };

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function useAffordanceAgent() {
  const connected = ref(false);
  const connecting = ref(true);
  const error = ref<string | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const jobs = ref<ResearchJob[]>([]);
  const busy = ref(false);

  const working = computed(() =>
    jobs.value.some((j) => j.status === "queued" || j.status === "running"),
  );

  const clientRef = shallowRef<AgentClient | null>(null);

  onMounted(() => {
    const sessionId = getOrCreateSessionId();
    let refreshTimer: ReturnType<typeof window.setInterval> | null = null;

    const client = new AgentClient({
      agent: AGENT_CLASS,
      name: sessionId,
      host: window.location.host,
      protocol: (window.location.protocol === "https:" ? "wss" : "ws") as "wss" | "ws",
      onStateUpdate: (state: ServerSessionState) => {
        messages.value = state.messages;
        jobs.value = state.jobs;
      },
      onStateUpdateError: (err: string) => {
        error.value = err;
      },
    });

    clientRef.value = client;
    refreshTimer = window.setInterval(() => {
      if (!jobs.value.some((j) => j.status === "queued" || j.status === "running")) return;
      void client.call("listSessionJobs", [], { timeout: 10000 }).catch(() => undefined);
    }, 2000);

    const handleOpen = () => {
      connected.value = true;
      connecting.value = false;
      error.value = null;
    };
    const handleClose = () => {
      connected.value = false;
    };
    const handleError = (evt: Event) => {
      error.value = evt instanceof ErrorEvent ? evt.message : "Connection error";
      connecting.value = false;
    };

    client.addEventListener("open", handleOpen);
    client.addEventListener("close", handleClose);
    client.addEventListener("error", handleError);

    client.ready
      .then(() => {
        connected.value = true;
        connecting.value = false;
        if (client.state) {
          const state = client.state as ServerSessionState;
          messages.value = state.messages;
          jobs.value = state.jobs;
        }
        void client.call("listSessionJobs", [], { timeout: 10000 }).catch(() => undefined);
      })
      .catch((err: unknown) => {
        error.value = err instanceof Error ? err.message : String(err);
        connecting.value = false;
      });

    onUnmounted(() => {
      client.removeEventListener("open", handleOpen);
      client.removeEventListener("close", handleClose);
      client.removeEventListener("error", handleError);
      if (refreshTimer !== null) {
        window.clearInterval(refreshTimer);
      }
      client.close();
      clientRef.value = null;
    });
  });

  async function ask(query: string, seed?: string): Promise<void> {
    const client = clientRef.value;
    if (!client) throw new Error("Agent client not ready");
    error.value = null;
    busy.value = true;
    try {
      const args: (string | undefined)[] = seed ? [query, seed] : [query];
      await client.call("ask", args, { timeout: 120000 });
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      busy.value = false;
    }
  }

  async function cancelResearchJob(jobId: ResearchJobId): Promise<void> {
    const client = clientRef.value;
    if (!client) throw new Error("Agent client not ready");
    error.value = null;
    try {
      await client.call("cancelResearchJob", [jobId], { timeout: 30000 });
      busy.value = false;
      await client.call("listSessionJobs", [], { timeout: 10000 });
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function resetSession(): Promise<void> {
    const client = clientRef.value;
    if (!client) throw new Error("Agent client not ready");
    await client.call("resetSession", [], { timeout: 30000 });
  }

  function startNewSession(): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, crypto.randomUUID());
    messages.value = [];
    jobs.value = [];
    busy.value = false;
    error.value = null;
    window.location.reload();
  }

  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__resetSession = resetSession;
  }

  return {
    connected,
    connecting,
    error,
    messages,
    jobs,
    busy,
    working,
    ask,
    cancelResearchJob,
    startNewSession,
    resetSession,
  };
}
