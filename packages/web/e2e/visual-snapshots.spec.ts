import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type ViewportName = "narrow" | "mobile" | "tablet" | "boundary" | "desktop" | "wide";
type InteractionRole = "button" | "link" | "tab" | "textbox";

type VisualFixture = {
  connected?: boolean;
  connecting?: boolean;
  error?: string | null;
  input?: string;
  busy?: boolean;
  messages?: unknown[];
  jobs?: unknown[];
  highlightedJobId?: string | null;
  admin?: {
    authenticated?: boolean;
    loading?: boolean;
    error?: string | null;
    copyMessage?: string | null;
    tokenInput?: string;
    savedToken?: string;
    summary?: unknown;
    tables?: unknown[];
    selectedTable?: string;
    tableRows?: unknown;
    tableLoading?: boolean;
    tableOffset?: number;
  };
};

type SnapshotState = {
  name: string;
  path: string;
  viewports: ViewportName[];
  fixture?: VisualFixture;
  heading: string;
  connectionText?: "Online" | "Offline" | "Connecting..." | null;
  requiredText?: string;
  requiredTexts?: string[];
  requiredTestId?: string;
  requiredInput?: { testId: string; value: string };
  expandText?: string;
  expandTexts?: string[];
  focusTestId?: string;
  scrollMessages?: "top" | "bottom";
  textScale?: "large";
  interaction?: {
    kind: "focus" | "hover";
    testId?: string;
    role?: InteractionRole;
    name?: string | RegExp;
  };
};

const snapshotDir = path.join(process.cwd(), "e2e-snapshots", "visual");
const fixedNow = "2026-06-20T21:30:00.000Z";
const earlier = "2026-06-20T21:28:30.000Z";

const viewports: Record<ViewportName, { width: number; height: number }> = {
  narrow: { width: 320, height: 740 },
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  boundary: { width: 960, height: 900 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 1000 },
};

const standardViewports: ViewportName[] = ["mobile", "tablet", "desktop", "wide"];
const stressViewports: ViewportName[] = ["narrow", "boundary"];

function querySnapshot(original: string) {
  return {
    query_id: "query_visual_1",
    schema_version: "0.1.0",
    original_user_query: original,
    parsed_at: fixedNow,
    locale: "en-US",
    timezone: "America/New_York",
    constraints: {
      affordance: {
        kind: "exact",
        canonical_label: "Sunday Mass",
        category: null,
        subtype: null,
        raw_phrase: "Mass",
        synonyms_considered: [],
        normalization_confidence: "high_confidence",
      },
      spatial: {
        kind: "near_place",
        raw_phrase: "Clifton Park",
        anchor_place_id: null,
        anchor_label: "Clifton Park, NY",
        anchor_address: null,
        anchor_coordinates: null,
        radius_distance: null,
        max_travel_time: null,
        travel_mode: null,
        jurisdiction: null,
        normalization_confidence: "high_confidence",
      },
      temporal: {
        kind: "relative_date",
        raw_phrase: "Sunday",
        timezone: "America/New_York",
        window_start: "2026-06-21T00:00:00.000-04:00",
        window_end: "2026-06-21T23:59:59.000-04:00",
        recurrence_filter: "Sunday",
        daypart: null,
        normalization_confidence: "high_confidence",
      },
      access: [],
    },
    context: {
      user_location: null,
      conversation_place: null,
      conversation_time_anchor: null,
      prior_constraints: [],
    },
    uncertainty: {
      ambiguities: [],
      inferred_constraints: [],
      unresolved_slots: [],
    },
    requested_answer_mode: "asynchronous_allowed",
  };
}

function job(status: "queued" | "running" | "completed" | "failed" | "cancelled", suffix: string, overrides: Record<string, unknown> = {}) {
  const query = `Where can I go to Mass in Clifton Park on Sunday? ${suffix}`.trim();
  return {
    job_id: `job_${status}_${suffix || "base"}`.replace(/\W+/g, "_"),
    query_id: `query_${status}_${suffix || "base"}`.replace(/\W+/g, "_"),
    query_snapshot: querySnapshot(query),
    status,
    created_at: earlier,
    updated_at: fixedNow,
    scheduled_at: earlier,
    completed_at: status === "queued" || status === "running" ? null : fixedNow,
    result_answer_id: status === "completed" ? "answer_visual_success" : null,
    error_message: status === "failed" ? "Could not extract a usable schedule from discovered sources: candidate page fetch failed with 530. Tried sources: https://www.stedwardtheconfessor.org/mass-times: Candidate page fetch failed for https://www.stedwardtheconfessor.org/mass-times: 530 | https://www.example.org/parish/schedule: Source did not match the requested place well enough." : null,
    ...overrides,
  };
}

function evidence(id: string, long = false, overrides: Record<string, unknown> = {}) {
  return {
    evidence_item_id: `evidence_${id}`,
    source_url: long
      ? "https://www.example.org/parish/schedules/sunday-mass-and-confession-times-with-seasonal-updates-and-special-liturgies"
      : "https://www.stedwardtheconfessor.org/mass-times",
    source_title: long ? "Saint Edward the Confessor Parish Sunday Mass Schedule and Seasonal Liturgy Updates" : "Mass Times",
    retrieved_at: fixedNow,
    evidence_span: long ? "Sunday Mass is listed at 8:30 AM, 10:30 AM, and 5:30 PM with holiday exceptions noted below." : "Sunday Mass: 8:30 AM and 10:30 AM.",
    extracted_text: long
      ? "The parish schedule lists Sunday Mass at 8:30 AM, 10:30 AM, and 5:30 PM. Visitors should confirm holiday schedules and special liturgies before traveling."
      : "Sunday Mass: 8:30 AM and 10:30 AM.",
    authority_level: "official",
    freshness_state: "current",
    ...overrides,
  };
}

function answerResult(kind: "verified" | "candidate" = "verified") {
  return {
    result_id: `result_${kind}`,
    claim_id: `claim_${kind}`,
    affordance_label: "Sunday Mass",
    place_label: kind === "candidate" ? "www.parish-example.org" : "St. Edward the Confessor Church",
    place_address: kind === "candidate" ? null : "569 Clifton Park Center Road, Clifton Park, NY",
    occurrence: {
      starts_at: null,
      ends_at: null,
      timezone: "America/New_York",
      recurrence_label: kind === "candidate" ? "Schedule page Mass times navigation home contact" : "Sundays at 8:30 AM and 10:30 AM",
    },
    access_conditions: [],
    confidence_state: kind === "candidate" ? "candidate" : "high_confidence",
    freshness_state: "current",
    verification_state: kind === "candidate" ? "candidate" : "verified",
    contradiction_state: "none",
    evidence_refs: [`evidence_${kind}`],
    evidence: [evidence(kind, true)],
    caveats: kind === "candidate" ? ["Schedule could not be verified from the extracted source text."] : ["Holiday schedules can differ."],
  };
}

function answer(kind: "verified" | "candidate" = "verified") {
  return {
    answer_id: kind === "candidate" ? "answer_visual_candidate" : "answer_visual_success",
    schema_version: "0.1.0",
    query_id: "query_visual_1",
    generated_at: fixedNow,
    answer_mode: "asynchronous",
    answer_state: "answered",
    original_user_query: "Where can I go to Mass in Clifton Park on Sunday?",
    normalized_query_ref: "query_visual_1",
    results: [answerResult(kind)],
    coverage_gaps: [],
    answer_summary: "St. Edward the Confessor Church lists Sunday Mass at 8:30 AM and 10:30 AM.",
    next_actions: [{ action_type: "verify", label: "Open the official parish schedule" }],
  };
}

function resultVariant(id: string, overrides: Record<string, unknown> = {}) {
  return {
    ...answerResult("verified"),
    result_id: `result_${id}`,
    claim_id: `claim_${id}`,
    evidence_refs: [`evidence_${id}`],
    evidence: [evidence(id, true)],
    ...overrides,
  };
}

function answerVariant(id: string, overrides: Record<string, unknown> = {}) {
  return {
    ...answer("verified"),
    answer_id: `answer_visual_${id}`,
    ...overrides,
  };
}

function answerMessage(answerValue: ReturnType<typeof answer>) {
  return { role: "assistant", content: answerValue.answer_summary, answer: answerValue, createdAt: fixedNow };
}

function chatFixture(kind: "active" | "success" | "failure" | "candidate" | "many-jobs" | "error" | "typed" | "connecting" | "offline" | "busy" | "cancelled" | "multi-result" | "no-next-actions" | "missing-fields" | "long-stack" | "punctuation-url" | "long-answer" | "multi-evidence" | "unsupported-failure" | "submitted-only" | "system-looking" | "queued-polling" | "running-polling" | "reconnecting-with-messages" | "offline-with-messages"): VisualFixture {
  const query = "Where can I go to Mass in Clifton Park on Sunday?";
  const baseMessages = [
    { role: "user", content: query, createdAt: earlier },
    { role: "system", content: "I’m looking that up for you. This may take a moment.", createdAt: earlier },
  ];

  if (kind === "typed") {
    return { connected: true, connecting: false, input: "Where can I find a public library open late near Clifton Park on Sunday?", messages: [], jobs: [] };
  }

  if (kind === "submitted-only") {
    return { connected: true, connecting: false, busy: true, messages: [{ role: "user", content: query, createdAt: earlier }], jobs: [] };
  }

  if (kind === "system-looking") {
    return { connected: true, connecting: false, busy: true, messages: baseMessages, jobs: [] };
  }

  if (kind === "queued-polling") {
    return { connected: true, connecting: false, messages: baseMessages, jobs: [job("queued", "queued polling interval")] };
  }

  if (kind === "running-polling") {
    return { connected: true, connecting: false, messages: baseMessages, jobs: [job("queued", "queued earlier"), job("running", "running polling interval")] };
  }

  if (kind === "reconnecting-with-messages") {
    return { connected: false, connecting: true, messages: baseMessages, jobs: [job("running", "while reconnecting")] };
  }

  if (kind === "offline-with-messages") {
    return { connected: false, connecting: false, error: "Connection lost while research was still visible in the session.", messages: baseMessages, jobs: [job("running", "while offline")] };
  }

  if (kind === "unsupported-failure") {
    return {
      connected: true,
      connecting: false,
      messages: [
        { role: "user", content: "Can Atlas guarantee every church schedule forever?", createdAt: earlier },
        { role: "assistant", content: "I couldn't produce a reliable answer for \"Can Atlas guarantee every church schedule forever?\": unsupported query shape and insufficient verifiable availability constraints.", createdAt: fixedNow },
      ],
      jobs: [job("failed", "unsupported query failure", { error_message: "Unsupported query failure: the request lacks a concrete affordance, place, and time window." })],
    };
  }

  if (kind === "long-answer") {
    const longAnswer = answerVariant("long_answer", {
      answer_summary: "Atlas found a verified schedule, but the answer summary is intentionally long enough to exercise paragraph wrapping, adjacent metadata, and the transition from answer text into fact cards without crowding the message bubble or pushing controls into awkward positions.",
      results: [resultVariant("long_answer", {
        place_label: "Saint Edward the Confessor Church and Parish Center with a Very Long Official Place Name",
        occurrence: { starts_at: null, ends_at: null, timezone: "America/New_York", recurrence_label: "Sundays at 8:30 AM, 10:30 AM, 12:15 PM, and 5:30 PM, except holidays and special liturgical weekends" },
      })],
    });
    return { connected: true, connecting: false, messages: [...baseMessages, answerMessage(longAnswer)], jobs: [job("completed", "long answer", { result_answer_id: "answer_visual_long_answer" })] };
  }

  if (kind === "multi-evidence") {
    const evidenceAnswer = answerVariant("multi_evidence", {
      results: [resultVariant("multi_evidence", {
        evidence_refs: ["evidence_multi_evidence_1", "evidence_multi_evidence_2"],
        evidence: [
          evidence("multi_evidence_1", true),
          evidence("multi_evidence_2", false, { evidence_span: null, source_title: "", source_url: "https://www.example.org/very/long/source/url/with/many/segments/that/must/wrap/inside/the/evidence/details/panel" }),
        ],
      })],
    });
    return { connected: true, connecting: false, messages: [...baseMessages, answerMessage(evidenceAnswer)], jobs: [job("completed", "multi evidence", { result_answer_id: "answer_visual_multi_evidence" })] };
  }

  if (kind === "cancelled") {
    return {
      connected: true,
      connecting: false,
      messages: baseMessages,
      jobs: [job("cancelled", "cancelled")],
    };
  }

  if (kind === "multi-result") {
    const multiAnswer = answerVariant("multi", {
      answer_summary: "Two verified Clifton Park options list Sunday Mass schedules.",
      results: [
        resultVariant("multi_1"),
        resultVariant("multi_2", {
          place_label: "Corpus Christi Church with a Long Parish Campus Name",
          place_address: "2001 Route 9, Round Lake, NY",
          occurrence: { starts_at: null, ends_at: null, timezone: "America/New_York", recurrence_label: "Sundays at 9:00 AM, 11:00 AM, and 6:00 PM" },
        }),
      ],
    });
    return { connected: true, connecting: false, messages: [...baseMessages, answerMessage(multiAnswer)], jobs: [job("completed", "multi", { result_answer_id: "answer_visual_multi" })] };
  }

  if (kind === "no-next-actions") {
    const noActionAnswer = answerVariant("no_actions", { next_actions: [], answer_summary: "Atlas found one verified option, with no suggested next action." });
    return { connected: true, connecting: false, messages: [...baseMessages, answerMessage(noActionAnswer)], jobs: [job("completed", "no actions", { result_answer_id: "answer_visual_no_actions" })] };
  }

  if (kind === "missing-fields") {
    const missingAnswer = answerVariant("missing_fields", {
      answer_summary: "I found a possible source but could not verify the schedule.",
      results: [resultVariant("missing", {
        place_label: "www.parish-example.org",
        place_address: null,
        occurrence: { starts_at: null, ends_at: null, timezone: "America/New_York", recurrence_label: "Home about contact menu search" },
        confidence_state: "candidate",
        verification_state: "candidate",
        caveats: [],
      })],
      next_actions: [],
    });
    return { connected: true, connecting: false, messages: [...baseMessages, answerMessage(missingAnswer)], jobs: [job("completed", "missing fields", { result_answer_id: "answer_visual_missing_fields" })] };
  }

  if (kind === "long-stack") {
    const longMessages = Array.from({ length: 10 }, (_, idx) => ({
      role: idx % 3 === 0 ? "system" : idx % 3 === 1 ? "user" : "assistant",
      content: idx % 3 === 1
        ? `Long user message ${idx}: Where can I go to Mass in Clifton Park on Sunday if I need parking, wheelchair access, a source URL, and a schedule that may wrap across several lines?`
        : `Long assistant/system message ${idx}: Atlas is preserving readable wrapping, timestamp alignment, and scroll behavior while the conversation grows taller than the viewport.`,
      createdAt: fixedNow,
    }));
    return { connected: true, connecting: false, messages: longMessages, jobs: [job("completed", "scroll pressure")] };
  }

  if (kind === "connecting") {
    return { connected: false, connecting: true, messages: [], jobs: [] };
  }

  if (kind === "offline") {
    return { connected: false, connecting: false, input: "Where can I go to Mass in Clifton Park on Sunday?", messages: [], jobs: [] };
  }

  if (kind === "busy") {
    return { connected: true, connecting: false, busy: true, input: "Where can I go to Mass in Clifton Park on Sunday?", messages: [], jobs: [] };
  }

  if (kind === "punctuation-url") {
    return {
      connected: true,
      connecting: false,
      messages: [{ role: "user", content: "Can I visit https://example.org/events? Need Sunday Mass, Clifton Park, NY!!!", createdAt: earlier }],
      jobs: [],
    };
  }

  if (kind === "active") {
    return { connected: true, connecting: false, messages: baseMessages, jobs: [job("running", "active")] };
  }

  if (kind === "failure") {
    return {
      connected: true,
      connecting: false,
      messages: [
        ...baseMessages,
        { role: "assistant", content: `I couldn't produce a reliable answer for "${query}": Could not extract a usable schedule from discovered sources.`, createdAt: fixedNow },
      ],
      jobs: [job("failed", "failed", { query_snapshot: querySnapshot(query) })],
    };
  }

  if (kind === "candidate") {
    return {
      connected: true,
      connecting: false,
      messages: [...baseMessages, { role: "assistant", content: answer("candidate").answer_summary, answer: answer("candidate"), createdAt: fixedNow }],
      jobs: [job("completed", "candidate", { result_answer_id: "answer_visual_candidate" })],
    };
  }

  if (kind === "many-jobs") {
    return {
      connected: true,
      connecting: false,
      messages: [...baseMessages, { role: "assistant", content: answer().answer_summary, answer: answer(), createdAt: fixedNow }],
      jobs: [
        job("queued", "queued status with long query wrapping through the activity list"),
        job("running", "running status"),
        job("completed", "completed status"),
        job("failed", "failed status"),
        job("cancelled", "cancelled status"),
      ],
      highlightedJobId: "job_completed_completed_status",
    };
  }

  if (kind === "error") {
    return { connected: false, connecting: false, error: "Connection error: websocket closed before the session state was synchronized.", messages: [], jobs: [] };
  }

  return {
    connected: true,
    connecting: false,
    messages: [...baseMessages, { role: "assistant", content: answer().answer_summary, answer: answer(), createdAt: fixedNow }],
    jobs: [job("completed", "completed", { result_answer_id: "answer_visual_success" })],
  };
}

function adminFixture(kind: "gate-typed" | "loading" | "invalid" | "summary" | "table" | "empty-table" | "copy-success" | "no-counts" | "many-tables" | "table-loading" | "page-enabled" | "many-rows"): VisualFixture {
  const summary = kind === "no-counts" ? {
    generated_at: fixedNow,
    status_counts: [],
    recent_jobs: [],
  } : {
    generated_at: fixedNow,
    status_counts: [
      { status: "queued", count: 2 },
      { status: "running", count: 1 },
      { status: "completed", count: 14 },
      { status: "failed", count: 3 },
      { status: "cancelled", count: 1 },
    ],
    recent_jobs: [
      { research_job_id: "job_recent_1", original_user_query: "Where can I go to Mass in Clifton Park on Sunday?", status: "completed", error_message: null, created_at: earlier, updated_at: fixedNow, completed_at: fixedNow },
      { research_job_id: "job_recent_2", original_user_query: "Where is a public library open late near Clifton Park with a very long query that wraps?", status: "failed", error_message: "Candidate page fetch failed with 530.", created_at: earlier, updated_at: fixedNow, completed_at: fixedNow },
    ],
  };
  const tables = kind === "many-tables" ? [
    { name: "research_job", label: "Research Jobs", count: 82 },
    { name: "answer", label: "Answers", count: 19 },
    { name: "answer_result", label: "Answer Results", count: 34 },
    { name: "availability_claim", label: "Availability Claims", count: 41 },
    { name: "evidence_item", label: "Evidence Items", count: 152 },
    { name: "coverage_gap", label: "Coverage Gaps", count: 14 },
    { name: "source_fetch", label: "Source Fetch Attempts", count: 230 },
    { name: "normalized_query", label: "Normalized Queries", count: 82 },
  ] : [
    { name: "research_job", label: "Research Jobs", count: kind === "empty-table" ? 0 : kind === "page-enabled" ? 82 : 32 },
    { name: "answer", label: "Answers", count: 9 },
    { name: "evidence_item", label: "Evidence Items", count: 52 },
    { name: "coverage_gap", label: "Coverage Gaps", count: 4 },
  ];
  const rows = kind === "empty-table" ? [] : [
    {
      job_id: "job_visual_table_1",
      status: "completed",
      original_user_query: "Where can I go to Mass in Clifton Park on Sunday with a very long value that must wrap cleanly inside a table cell?",
      source_url: "https://www.example.org/parish/schedules/sunday-mass-and-confession-times-with-seasonal-updates-and-special-liturgies",
      created_at: earlier,
      updated_at: fixedNow,
      metadata: { confidence: "high", source_count: 2, notes: "JSON-like content should clamp without breaking layout." },
    },
    {
      job_id: "job_visual_table_2",
      status: "failed",
      original_user_query: "Unsupported query failure example",
      source_url: null,
      created_at: earlier,
      updated_at: fixedNow,
      metadata: null,
    },
  ];
  const tableRows = kind === "many-rows"
    ? Array.from({ length: 30 }, (_, idx) => ({
        job_id: `job_visual_many_rows_${idx + 1}`,
        status: idx % 5 === 0 ? "failed" : idx % 3 === 0 ? "running" : "completed",
        original_user_query: `Many-row table visual review item ${idx + 1}: a long query value should remain readable without creating narrow high cells or page overflow.`,
        source_url: idx % 4 === 0 ? null : `https://www.example.org/source/${idx + 1}/with/a/long/path/for/table/wrapping/review`,
        created_at: earlier,
        updated_at: fixedNow,
        metadata: { row: idx + 1, confidence: idx % 2 === 0 ? "high" : "candidate", notes: "Repeated rows exercise vertical scroll and sticky table headers." },
      }))
    : rows;

  if (kind === "gate-typed") return { connected: true, connecting: false, admin: { tokenInput: "atlas-admin-token-preview" } };
  if (kind === "loading") return { connected: true, connecting: false, admin: { tokenInput: "atlas-admin-token-preview", loading: true } };
  if (kind === "invalid") return { connected: true, connecting: false, admin: { tokenInput: "wrong-token", error: "Invalid admin bearer token." } };

  return {
    connected: true,
    connecting: false,
    admin: {
      authenticated: true,
      savedToken: "atlas-admin-token-preview",
      tokenInput: "atlas-admin-token-preview",
      copyMessage: kind === "copy-success" ? "Authorization header copied." : null,
      summary,
      tables,
      selectedTable: "research_job",
      tableRows: kind === "summary" || kind === "copy-success" || kind === "no-counts"
        ? null
        : { table: tables[0], limit: 25, offset: kind === "page-enabled" ? 25 : 0, rows: tableRows },
      tableLoading: kind === "table-loading",
      tableOffset: kind === "page-enabled" ? 25 : 0,
    },
  };
}

const states: SnapshotState[] = [
  { name: "home-empty", path: "/", viewports: ["mobile", "tablet", "desktop", "wide"], heading: "Affordance Atlas", requiredText: "Ask when and where something is available" },
  { name: "home-empty-stress-widths", path: "/", viewports: stressViewports, heading: "Affordance Atlas", requiredText: "Ask when and where something is available" },
  { name: "home-empty-large-text", path: "/", viewports: standardViewports, heading: "Affordance Atlas", requiredText: "Ask when and where something is available", textScale: "large" },
  { name: "global-home-connecting", path: "/", viewports: standardViewports, fixture: chatFixture("connecting"), heading: "Affordance Atlas", connectionText: "Connecting...", requiredText: "Ask when and where something is available" },
  { name: "global-home-offline", path: "/", viewports: standardViewports, fixture: chatFixture("offline"), heading: "Affordance Atlas", connectionText: "Offline", requiredInput: { testId: "chat-input", value: "Where can I go to Mass in Clifton Park on Sunday?" } },
  { name: "home-input-focused", path: "/", viewports: standardViewports, heading: "Affordance Atlas", requiredText: "Ask when and where something is available", interaction: { kind: "focus", testId: "chat-input" } },
  { name: "home-example-hover", path: "/", viewports: standardViewports, heading: "Affordance Atlas", requiredText: "Statue of Liberty", interaction: { kind: "hover", role: "button", name: /Statue of Liberty/ } },
  { name: "home-example-focus", path: "/", viewports: standardViewports, heading: "Affordance Atlas", requiredText: "St. Patrick", interaction: { kind: "focus", role: "button", name: /St\. Patrick/ } },
  { name: "home-new-chat-hover", path: "/", viewports: standardViewports, heading: "Affordance Atlas", requiredText: "New chat", interaction: { kind: "hover", testId: "new-chat-button" } },
  { name: "home-new-chat-focus", path: "/", viewports: standardViewports, heading: "Affordance Atlas", requiredText: "New chat", interaction: { kind: "focus", testId: "new-chat-button" } },
  { name: "home-typed-query", path: "/", viewports: standardViewports, fixture: chatFixture("typed"), heading: "Affordance Atlas", requiredInput: { testId: "chat-input", value: "Where can I find a public library open late near Clifton Park on Sunday?" } },
  { name: "home-busy-disabled", path: "/", viewports: standardViewports, fixture: chatFixture("busy"), heading: "Affordance Atlas", requiredText: "Sending", requiredInput: { testId: "chat-input", value: "Where can I go to Mass in Clifton Park on Sunday?" } },
  { name: "chat-submitted-user-only", path: "/", viewports: standardViewports, fixture: chatFixture("submitted-only"), heading: "Affordance Atlas", requiredTexts: ["Where can I go to Mass in Clifton Park on Sunday?", "Sending"] },
  { name: "chat-system-looking-only", path: "/", viewports: standardViewports, fixture: chatFixture("system-looking"), heading: "Affordance Atlas", requiredTexts: ["I’m looking that up for you", "Sending"] },
  { name: "chat-queued-polling", path: "/", viewports: standardViewports, fixture: chatFixture("queued-polling"), heading: "Affordance Atlas", requiredTexts: ["Queued for research", "queued"] },
  { name: "chat-running-polling", path: "/", viewports: standardViewports, fixture: chatFixture("running-polling"), heading: "Affordance Atlas", requiredTexts: ["Checking sources", "running"] },
  { name: "chat-reconnecting-with-messages", path: "/", viewports: standardViewports, fixture: chatFixture("reconnecting-with-messages"), heading: "Affordance Atlas", connectionText: "Connecting...", requiredTexts: ["I’m looking that up for you", "Checking sources"] },
  { name: "chat-offline-with-messages", path: "/", viewports: standardViewports, fixture: chatFixture("offline-with-messages"), heading: "Affordance Atlas", connectionText: "Offline", requiredTexts: ["Connection lost", "Checking sources"] },
  { name: "chat-active-research", path: "/", viewports: ["mobile", "tablet", "desktop", "wide"], fixture: chatFixture("active"), heading: "Affordance Atlas", requiredTestId: "working-indicator" },
  { name: "chat-active-actions-focus", path: "/", viewports: standardViewports, fixture: chatFixture("active"), heading: "Affordance Atlas", requiredText: "Cancel research", interaction: { kind: "focus", role: "button", name: "Cancel research" } },
  { name: "chat-cancelled-research", path: "/", viewports: standardViewports, fixture: chatFixture("cancelled"), heading: "Affordance Atlas", requiredTexts: ["cancelled", "Research canceled."] },
  { name: "chat-success-answer", path: "/", viewports: ["mobile", "tablet", "desktop", "wide"], fixture: chatFixture("success"), heading: "Affordance Atlas", requiredText: "St. Edward the Confessor" },
  { name: "chat-success-stress-widths", path: "/", viewports: stressViewports, fixture: chatFixture("success"), heading: "Affordance Atlas", requiredText: "St. Edward the Confessor" },
  { name: "chat-multi-result-answer", path: "/", viewports: standardViewports, fixture: chatFixture("multi-result"), heading: "Affordance Atlas", requiredTexts: ["Two verified Clifton Park options", "Corpus Christi Church"] },
  { name: "chat-long-answer", path: "/", viewports: standardViewports, fixture: chatFixture("long-answer"), heading: "Affordance Atlas", requiredTexts: ["intentionally long enough", "Very Long Official Place Name"] },
  { name: "chat-long-answer-large-text", path: "/", viewports: standardViewports, fixture: chatFixture("long-answer"), heading: "Affordance Atlas", requiredTexts: ["intentionally long enough", "Very Long Official Place Name"], textScale: "large" },
  { name: "chat-no-next-actions", path: "/", viewports: standardViewports, fixture: chatFixture("no-next-actions"), heading: "Affordance Atlas", requiredText: "no suggested next action" },
  { name: "chat-missing-fields", path: "/", viewports: standardViewports, fixture: chatFixture("missing-fields"), heading: "Affordance Atlas", requiredTexts: ["Not verified", "Unverified lead"] },
  { name: "chat-punctuation-url-message", path: "/", viewports: standardViewports, fixture: chatFixture("punctuation-url"), heading: "Affordance Atlas", requiredText: "https://example.org/events" },
  { name: "chat-scroll-pressure", path: "/", viewports: standardViewports, fixture: chatFixture("long-stack"), heading: "Affordance Atlas", requiredText: "scroll behavior" },
  { name: "chat-scroll-pressure-top", path: "/", viewports: standardViewports, fixture: chatFixture("long-stack"), heading: "Affordance Atlas", requiredText: "Long assistant/system message", scrollMessages: "top" },
  { name: "chat-scroll-pressure-bottom", path: "/", viewports: standardViewports, fixture: chatFixture("long-stack"), heading: "Affordance Atlas", requiredText: "Long assistant/system message", scrollMessages: "bottom" },
  { name: "chat-evidence-expanded", path: "/", viewports: standardViewports, fixture: chatFixture("success"), heading: "Affordance Atlas", requiredText: "Sources and evidence", expandText: "Sources and evidence" },
  { name: "chat-multiple-evidence-expanded", path: "/", viewports: standardViewports, fixture: chatFixture("multi-evidence"), heading: "Affordance Atlas", requiredTexts: ["Sources and evidence", "very/long/source/url"], expandText: "Sources and evidence" },
  { name: "chat-source-link-focus", path: "/", viewports: standardViewports, fixture: chatFixture("success"), heading: "Affordance Atlas", requiredText: "Saint Edward the Confessor Parish Sunday Mass Schedule", expandText: "Sources and evidence", interaction: { kind: "focus", testId: "answer-source-link" } },
  { name: "chat-source-link-hover", path: "/", viewports: standardViewports, fixture: chatFixture("success"), heading: "Affordance Atlas", requiredText: "Saint Edward the Confessor Parish Sunday Mass Schedule", expandText: "Sources and evidence", interaction: { kind: "hover", testId: "answer-source-link" } },
  { name: "chat-caveats-expanded", path: "/", viewports: standardViewports, fixture: chatFixture("success"), heading: "Affordance Atlas", requiredText: "Caveats", expandText: "Caveats" },
  { name: "chat-candidate-warning", path: "/", viewports: standardViewports, fixture: chatFixture("candidate"), heading: "Affordance Atlas", requiredText: "Source found; schedule not verified." },
  { name: "chat-failure", path: "/", viewports: ["mobile", "tablet", "desktop", "wide"], fixture: chatFixture("failure"), heading: "Affordance Atlas", requiredTexts: ["couldn't produce a reliable answer", "Partial answer shell", "Retry", "Report issue"] },
  { name: "chat-failure-details-expanded", path: "/", viewports: standardViewports, fixture: chatFixture("failure"), heading: "Affordance Atlas", requiredTexts: ["candidate page fetch failed", "Sources tried"], expandTexts: ["Sources tried", "Technical details"] },
  { name: "chat-unsupported-failure", path: "/", viewports: standardViewports, fixture: chatFixture("unsupported-failure"), heading: "Affordance Atlas", requiredTexts: ["unsupported query shape", "Unsupported query failure"] },
  { name: "chat-many-job-statuses", path: "/", viewports: standardViewports, fixture: chatFixture("many-jobs"), heading: "Affordance Atlas", requiredText: "cancelled" },
  { name: "chat-job-link-hover", path: "/", viewports: standardViewports, fixture: chatFixture("many-jobs"), heading: "Affordance Atlas", requiredText: "completed status", interaction: { kind: "hover", role: "button", name: /completed status/ } },
  { name: "chat-job-link-focus", path: "/", viewports: standardViewports, fixture: chatFixture("many-jobs"), heading: "Affordance Atlas", requiredText: "completed status", interaction: { kind: "focus", role: "button", name: /completed status/ } },
  { name: "home-error-banner", path: "/", viewports: standardViewports, fixture: chatFixture("error"), heading: "Affordance Atlas", connectionText: "Offline", requiredTestId: "error-banner" },
  { name: "global-admin-connecting", path: "/admin", viewports: standardViewports, fixture: chatFixture("connecting"), heading: "Admin", connectionText: "Connecting...", requiredTestId: "admin-token-input" },
  { name: "global-admin-offline", path: "/admin", viewports: standardViewports, fixture: chatFixture("offline"), heading: "Admin", connectionText: "Offline", requiredTestId: "admin-token-input" },
  { name: "admin-back-hover", path: "/admin", viewports: standardViewports, heading: "Admin", requiredText: "Back to app", interaction: { kind: "hover", role: "link", name: "Back to app" } },
  { name: "admin-back-focus", path: "/admin", viewports: standardViewports, heading: "Admin", requiredText: "Back to app", interaction: { kind: "focus", role: "link", name: "Back to app" } },
  { name: "admin-gate-empty", path: "/admin", viewports: ["mobile", "tablet", "desktop", "wide"], heading: "Admin", requiredTestId: "admin-token-input" },
  { name: "admin-gate-focus", path: "/admin", viewports: standardViewports, heading: "Admin", requiredTestId: "admin-token-input", interaction: { kind: "focus", testId: "admin-token-input" } },
  { name: "admin-gate-typed", path: "/admin", viewports: standardViewports, fixture: adminFixture("gate-typed"), heading: "Admin", requiredInput: { testId: "admin-token-input", value: "atlas-admin-token-preview" } },
  { name: "admin-unlock-focus", path: "/admin", viewports: standardViewports, fixture: adminFixture("gate-typed"), heading: "Admin", requiredInput: { testId: "admin-token-input", value: "atlas-admin-token-preview" }, interaction: { kind: "focus", role: "button", name: "Unlock admin" } },
  { name: "admin-gate-loading", path: "/admin", viewports: standardViewports, fixture: adminFixture("loading"), heading: "Admin", requiredText: "Verifying..." },
  { name: "admin-gate-invalid", path: "/admin", viewports: standardViewports, fixture: adminFixture("invalid"), heading: "Admin", requiredText: "Invalid admin bearer token." },
  { name: "admin-auth-summary", path: "/admin", viewports: ["mobile", "tablet", "desktop", "wide"], fixture: adminFixture("summary"), heading: "Admin", requiredText: "Saved bearer token" },
  { name: "admin-summary-recent-expanded", path: "/admin", viewports: standardViewports, fixture: adminFixture("summary"), heading: "Admin", requiredText: "Where is a public library open late", expandText: "Recent Jobs" },
  { name: "admin-summary-empty", path: "/admin", viewports: standardViewports, fixture: adminFixture("no-counts"), heading: "Admin", requiredText: "No jobs found.", expandText: "Recent Jobs" },
  { name: "admin-copy-success", path: "/admin", viewports: standardViewports, fixture: adminFixture("copy-success"), heading: "Admin", requiredText: "Authorization header copied." },
  { name: "admin-copy-token-focus", path: "/admin", viewports: standardViewports, fixture: adminFixture("summary"), heading: "Admin", requiredText: "Copy token", interaction: { kind: "focus", role: "button", name: "Copy token" } },
  { name: "admin-copy-button-focus", path: "/admin", viewports: standardViewports, fixture: adminFixture("summary"), heading: "Admin", requiredText: "Copy header", interaction: { kind: "focus", role: "button", name: "Copy header" } },
  { name: "admin-forget-hover", path: "/admin", viewports: standardViewports, fixture: adminFixture("summary"), heading: "Admin", requiredText: "Forget token", interaction: { kind: "hover", role: "button", name: "Forget token" } },
  { name: "admin-data-table", path: "/admin", viewports: ["mobile", "tablet", "desktop", "wide"], fixture: adminFixture("table"), heading: "Admin", requiredTestId: "admin-data-table" },
  { name: "admin-data-table-stress-widths", path: "/admin", viewports: stressViewports, fixture: adminFixture("table"), heading: "Admin", requiredTestId: "admin-data-table" },
  { name: "admin-data-table-large-text", path: "/admin", viewports: standardViewports, fixture: adminFixture("table"), heading: "Admin", requiredTestId: "admin-data-table", textScale: "large" },
  { name: "admin-many-row-table", path: "/admin", viewports: standardViewports, fixture: adminFixture("many-rows"), heading: "Admin", requiredText: "Many-row table visual review item 30" },
  { name: "admin-many-table-tabs", path: "/admin", viewports: standardViewports, fixture: adminFixture("many-tables"), heading: "Admin", requiredTexts: ["Source Fetch Attempts", "Normalized Queries"] },
  { name: "admin-table-loading", path: "/admin", viewports: standardViewports, fixture: adminFixture("table-loading"), heading: "Admin", requiredText: "Loading..." },
  { name: "admin-table-pagination-enabled", path: "/admin", viewports: standardViewports, fixture: adminFixture("page-enabled"), heading: "Admin", requiredText: "26-27 of 82", interaction: { kind: "focus", role: "button", name: "Previous" } },
  { name: "admin-table-pagination-disabled", path: "/admin", viewports: standardViewports, fixture: adminFixture("table"), heading: "Admin", requiredText: "1-2 of 32" },
  { name: "admin-refresh-hover", path: "/admin", viewports: standardViewports, fixture: adminFixture("table"), heading: "Admin", requiredText: "Refresh", interaction: { kind: "hover", role: "button", name: "Refresh" } },
  { name: "admin-table-tab-focus", path: "/admin", viewports: standardViewports, fixture: adminFixture("table"), heading: "Admin", requiredText: "Evidence Items", interaction: { kind: "focus", role: "tab", name: /Evidence Items/ } },
  { name: "admin-empty-table", path: "/admin", viewports: standardViewports, fixture: adminFixture("empty-table"), heading: "Admin", requiredText: "No rows for this table." },
];

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflowX = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  expect(overflowX).toBe(0);
}

async function expectInteractiveLayout(page: Page): Promise<void> {
  const violations = await page.evaluate(() => {
    const selectors = "button, a[href], input, summary, [role='tab']";
    function visibleRectFor(element: HTMLElement) {
      const base = element.getBoundingClientRect();
      let left = base.left;
      let top = base.top;
      let right = base.right;
      let bottom = base.bottom;

      let parent = element.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        if (style.overflow !== "visible" || style.overflowX !== "visible" || style.overflowY !== "visible") {
          const parentRect = parent.getBoundingClientRect();
          left = Math.max(left, parentRect.left);
          top = Math.max(top, parentRect.top);
          right = Math.min(right, parentRect.right);
          bottom = Math.min(bottom, parentRect.bottom);
        }
        parent = parent.parentElement;
      }

      return {
        left,
        top,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    }

    const elements = [...document.querySelectorAll<HTMLElement>(selectors)]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = visibleRectFor(element);
        return !element.closest("details:not([open]) :not(summary)") && style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      });

    const issues: string[] = [];
    for (const element of elements) {
      const baseRect = element.getBoundingClientRect();
      const rect = visibleRectFor(element);
      const label = `${element.tagName.toLowerCase()}${element.textContent?.trim() ? `:${element.textContent.trim().slice(0, 48)}` : ""}`;
      const requiresTargetSize = element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element.tagName.toLowerCase() === "summary" || element.getAttribute("role") === "tab";
      const clippedByScrollport = rect.width < baseRect.width - 1 || rect.height < baseRect.height - 1;
      if (!clippedByScrollport && requiresTargetSize && (rect.width < 24 || rect.height < 24)) {
        issues.push(`${label} has a too-small visible target (${Math.round(rect.width)}x${Math.round(rect.height)})`);
      }
      if (!clippedByScrollport && (element instanceof HTMLButtonElement || element.tagName.toLowerCase() === "a" || element.tagName.toLowerCase() === "summary")) {
        if (element.scrollWidth - element.clientWidth > 1 || element.scrollHeight - element.clientHeight > 1) {
          issues.push(`${label} clips its content`);
        }
      }
    }

    for (let i = 0; i < elements.length; i += 1) {
      const first = elements[i];
      if (!first) continue;
      const firstRect = visibleRectFor(first);
      for (let j = i + 1; j < elements.length; j += 1) {
        const second = elements[j];
        if (!second) continue;
        if (first.contains(second) || second.contains(first)) continue;
        const secondRect = visibleRectFor(second);
        const overlapX = Math.max(0, Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left));
        const overlapY = Math.max(0, Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top));
        if (overlapX * overlapY > 4) {
          issues.push(`${first.tagName.toLowerCase()} overlaps ${second.tagName.toLowerCase()}`);
        }
      }
    }

    return issues;
  });

  expect(violations).toEqual([]);
}

async function expectReadableText(page: Page): Promise<void> {
  const violations = await page.evaluate(() => {
    function parseRgb(value: string): [number, number, number] | null {
      const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return null;
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    }

    function luminance(rgb: [number, number, number]): number {
      const [r, g, b] = rgb.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
    }

    function contrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return (lighter + 0.05) / (darker + 0.05);
    }

    function effectiveBackground(element: Element): [number, number, number] | null {
      let current: Element | null = element;
      while (current) {
        const background = window.getComputedStyle(current).backgroundColor;
        if (background && !background.endsWith(", 0)") && background !== "transparent") {
          const rgb = parseRgb(background);
          if (rgb) return rgb;
        }
        current = current.parentElement;
      }
      return parseRgb(window.getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255];
    }

    const issues: string[] = [];
    const elements = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => {
        const text = element.innerText?.replace(/\s+/g, " ").trim();
        if (!text) return false;
        if ([...element.children].some((child) => (child as HTMLElement).innerText?.trim())) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      });

    for (const element of elements) {
      const style = window.getComputedStyle(element);
      const fontSize = Number.parseFloat(style.fontSize);
      const foreground = parseRgb(style.color);
      const background = effectiveBackground(element);
      if (!foreground || !background) continue;
      const ratio = contrastRatio(foreground, background);
      const largeText = fontSize >= 18 || (fontSize >= 14 && Number.parseInt(style.fontWeight, 10) >= 700);
      const minRatio = largeText ? 3 : 4.5;
      const label = `${element.tagName.toLowerCase()}:${element.innerText.replace(/\s+/g, " ").trim().slice(0, 56)}`;
      if (fontSize < 11) {
        issues.push(`${label} is too small (${fontSize.toFixed(1)}px)`);
      }
      if (ratio < minRatio) {
        issues.push(`${label} has low contrast (${ratio.toFixed(2)}:1)`);
      }
    }

    return issues;
  });

  expect(violations).toEqual([]);
}

async function expectConnection(page: Page, connectionText: SnapshotState["connectionText"]): Promise<void> {
  if (connectionText === null) {
    return;
  }
  await expect(page.getByTestId("connection-status")).toHaveText(connectionText ?? "Online", { timeout: 60000 });
}

function interactionLocator(page: Page, interaction: NonNullable<SnapshotState["interaction"]>) {
  if (interaction.testId) {
    return page.getByTestId(interaction.testId).first();
  }
  if (!interaction.role || interaction.name === undefined) {
    throw new Error("Interaction requires either testId or role/name.");
  }
  return page.getByRole(interaction.role, { name: interaction.name }).first();
}

async function applyFixture(page: Page, fixture: VisualFixture): Promise<void> {
  await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>).__applyAffordanceAtlasVisualFixture === "function");
  await page.evaluate((value) => {
    const fn = (window as unknown as { __applyAffordanceAtlasVisualFixture: (fixture: VisualFixture) => void }).__applyAffordanceAtlasVisualFixture;
    fn(value);
  }, fixture);
}

async function applyKeyboardFocus(page: Page, locator: ReturnType<typeof interactionLocator>): Promise<void> {
  const handle = await locator.elementHandle();
  if (!handle) throw new Error("Focus target was not found.");
  await page.keyboard.press("Escape");
  for (let idx = 0; idx < 80; idx += 1) {
    const focused = await handle.evaluate((element) => document.activeElement === element);
    if (focused) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Focus target was not reachable by keyboard tab order.");
}

test.describe("visual snapshots", () => {
  test.beforeAll(async () => {
    await mkdir(snapshotDir, { recursive: true });
  });

  for (const state of states) {
    for (const viewportName of state.viewports) {
      test(`captures ${state.name} ${viewportName}`, async ({ page }) => {
        await page.setViewportSize(viewports[viewportName]);
        await page.goto(state.path, { waitUntil: "networkidle" });
        if (state.textScale === "large") {
          await page.addStyleTag({ content: ":root { font-size: 125%; }" });
        }
        if (state.fixture) {
          await applyFixture(page, state.fixture);
        }
        await expectConnection(page, state.connectionText);
        for (const expandText of [...(state.expandText ? [state.expandText] : []), ...(state.expandTexts ?? [])]) {
          await page.getByText(expandText).first().click();
        }
        if (state.focusTestId) {
          await page.getByTestId(state.focusTestId).focus();
        }
        if (state.scrollMessages) {
          await page.getByTestId("messages-container").evaluate((element, position) => {
            element.scrollTop = position === "top" ? 0 : element.scrollHeight;
          }, state.scrollMessages);
        }
        if (state.interaction) {
          const locator = interactionLocator(page, state.interaction);
          if (state.interaction.kind === "focus") {
            await applyKeyboardFocus(page, locator);
          } else {
            await locator.hover();
          }
        }
        await expect(page.getByRole("heading", { name: state.heading })).toBeVisible();
        if (state.requiredText) {
          await expect(page.getByText(state.requiredText).first()).toBeVisible();
        }
        for (const text of state.requiredTexts ?? []) {
          await expect(page.getByText(text).first()).toBeVisible();
        }
        if (state.requiredTestId) {
          await expect(page.getByTestId(state.requiredTestId).first()).toBeVisible();
        }
        if (state.requiredInput) {
          await expect(page.getByTestId(state.requiredInput.testId)).toHaveValue(state.requiredInput.value);
        }
        await expectNoHorizontalOverflow(page);
        await expectInteractiveLayout(page);
        await expectReadableText(page);

        await page.screenshot({
          path: path.join(snapshotDir, `${state.name}-${viewportName}.png`),
          fullPage: true,
        });
      });
    }
  }
});
