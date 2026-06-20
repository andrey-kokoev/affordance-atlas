import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { Ai } from "@cloudflare/workers-types";
import { z } from "zod";
import {
  type NormalizedQuery,
  type ResearchJobId,
  type AnswerId,
  type PlaceId,
  type AffordanceId,
  type ClaimId,
  type EvidenceItemId,
  buildAnswer,
} from "@affordance-atlas/domain";
import * as db from "./db.js";

export interface ResearchContext {
  db: import("@cloudflare/workers-types").D1Database;
  ai: Ai;
  browser: unknown;
  sessionId?: string;
}

const ExtractedScheduleSchema = z.object({
  found: z.boolean(),
  place_name: z.string().nullable(),
  place_address: z.string().nullable(),
  affordance_label: z.string().nullable(),
  schedule_description: z.string().nullable(),
  recurrence_rule: z.string().nullable(),
  recurrence_label: z.string().nullable(),
  source_url: z.string().nullable(),
  source_title: z.string().nullable(),
  confidence: z.enum(["high_confidence", "probable", "candidate", "insufficient"]),
});

const CandidateUrlsSchema = z.object({
  urls: z.array(z.string()).min(1).max(6),
});

type WorkersAiModelFactory = ReturnType<typeof createWorkersAI>;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractDuckDuckGoUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/uddg=([^&"']+)/g)) {
    const uddg = match[1];
    if (!uddg) continue;
    try {
      const parsed = new URL(decodeURIComponent(uddg));
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (/duckduckgo\.com|google\.com|bing\.com/i.test(parsed.hostname)) continue;
      urls.push(parsed.toString());
    } catch {
      // Ignore malformed search result URLs.
    }
  }
  return [...new Set(urls)];
}

function decodeBingRedirect(url: string): string {
  const decoded = decodeHtmlEntities(url);
  try {
    const parsed = new URL(decoded);
    const target = parsed.searchParams.get("u");
    if (parsed.hostname.includes("bing.com") && target?.startsWith("a1")) {
      const base64 = target.slice(2).replace(/-/g, "+").replace(/_/g, "/");
      return atob(base64);
    }
  } catch {
    return decoded;
  }
  return decoded;
}

function extractBingUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const raw = match[1];
    if (!raw) continue;
    try {
      const href = new URL(decodeHtmlEntities(raw), "https://www.bing.com").toString();
      const parsed = new URL(decodeBingRedirect(href));
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (/bing\.com|google\.com|duckduckgo\.com/i.test(parsed.hostname)) continue;
      if (/microsoft\.com|msn\.com|office\.com|live\.com/i.test(parsed.hostname)) continue;
      urls.push(parsed.toString());
    } catch {
      // Ignore malformed search result URLs.
    }
  }
  return [...new Set(urls)];
}

function scoreCandidateUrl(url: string, searchQuery: string): number {
  const parsed = new URL(url);
  const haystack = `${parsed.hostname} ${parsed.pathname}`.toLowerCase();
  const terms = searchQuery.toLowerCase().split(/\W+/).filter((term) => term.length >= 4);
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += 2;
  }
  if (/\.gov$/i.test(parsed.hostname)) score += 8;
  if (/\.edu$/i.test(parsed.hostname)) score += 5;
  if (/\.org$/i.test(parsed.hostname)) score += 3;
  if (/hours|visit|calendar|schedule|mass|market|events|admission|locations/i.test(parsed.pathname)) score += 4;
  if (/facebook|instagram|tripadvisor|yelp|wikipedia|youtube/i.test(parsed.hostname)) score -= 8;
  return score;
}

function buildSearchQuery(query: NormalizedQuery): string {
  const raw = [
    query.constraints.affordance.raw_phrase,
    query.constraints.affordance.canonical_label,
    query.constraints.spatial.raw_phrase,
    query.constraints.spatial.anchor_label,
    query.constraints.temporal.raw_phrase,
    query.original_user_query,
  ].filter(Boolean).join(" ");
  const stopwords = new Set([
    "when", "what", "where", "which", "who", "whom", "whose", "why", "how",
    "can", "could", "would", "should", "is", "are", "do", "does", "did",
    "i", "me", "my", "we", "you", "the", "a", "an", "to", "of", "for", "in", "on", "at", "near",
    "this", "that", "these", "those", "today", "tomorrow", "tonight", "week", "weekend",
  ]);
  const terms = raw
    .split(/\W+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !stopwords.has(term.toLowerCase()));
  return `${[...new Set(terms)].join(" ")} official hours schedule availability`.trim();
}

function buildSearchQueries(query: NormalizedQuery): string[] {
  const original = query.original_user_query.trim();
  const normalized = buildSearchQuery(query);
  const variants = [
    normalized,
    `${original} times`,
    `${original} official schedule hours`,
    `${original} availability`,
  ];
  if (/\bmass\b/i.test(original)) {
    variants.unshift(`${original} Catholic Mass times`);
  }
  return [...new Set(variants.map((item) => item.trim()).filter(Boolean))];
}

function suggestNamedPlaceUrls(query: NormalizedQuery): string[] {
  const ignoredPhrases = new Set(["new york"]);
  const urls: string[] = [];
  const matches = query.original_user_query.match(/\b[A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){2,}\b/g) ?? [];
  for (const match of matches) {
    const phrase = match.trim();
    if (ignoredPhrases.has(phrase.toLowerCase())) continue;
    const slug = phrase.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (slug.length < 8 || slug.length > 48) continue;
    urls.push(
      `https://www.${slug}.com/visit/`,
      `https://${slug}.com/visit/`,
      `https://www.${slug}.com/`,
      `https://${slug}.com/`,
    );
  }
  return [...new Set(urls)].slice(0, 8);
}

function significantTerms(value: string | null | undefined): string[] {
  if (!value) return [];
  const ignored = new Set([
    "when", "what", "where", "which", "open", "opens", "closed", "close", "closes", "hours", "hour",
    "schedule", "scheduled", "availability", "available", "visit", "visiting", "time", "times", "public",
    "this", "that", "these", "those", "today", "tomorrow", "tonight", "week", "weekend", "near",
    "the", "and", "for", "with", "from", "into", "onto", "new", "york",
  ]);
  return [...new Set(
    value
      .toLowerCase()
      .split(/\W+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 4 && !ignored.has(term)),
  )];
}

function countMatches(haystack: string, terms: string[]): number {
  return terms.filter((term) => haystack.includes(term)).length;
}

function isLowAuthorityAvailabilityHost(hostname: string): boolean {
  return (
    /(^|[-.])(tickets?|tours?|passes?|deals?|coupons?)([-.]|$)/i.test(hostname) ||
    /(shoppinghours|holidayhours|openinghours|storehours|hoursguide|businessyab)/i.test(hostname)
  );
}

function assertSourceRelevant(query: NormalizedQuery, url: string, pageText: string): void {
  const hostname = new URL(url).hostname;
  if (isLowAuthorityAvailabilityHost(hostname)) {
    throw new Error(`Source looked like a third-party ticketing or tour page rather than an authoritative availability source: ${url}`);
  }
  const haystack = `${url} ${pageText.slice(0, 24000)}`.toLowerCase();
  const placeTerms = [
    ...significantTerms(query.constraints.spatial.raw_phrase),
    ...significantTerms(query.constraints.spatial.anchor_label),
    ...significantTerms(query.constraints.spatial.anchor_address),
  ];
  const affordanceTerms = [
    ...significantTerms(query.constraints.affordance.raw_phrase),
    ...significantTerms(query.constraints.affordance.canonical_label),
    ...significantTerms(query.constraints.affordance.category),
    ...significantTerms(query.constraints.affordance.subtype),
  ];
  const uniquePlaceTerms = [...new Set(placeTerms)];
  const uniqueAffordanceTerms = [...new Set(affordanceTerms)];
  const requiredPlaceMatches = Math.min(2, uniquePlaceTerms.length);
  const requiredAffordanceMatches = Math.min(3, uniqueAffordanceTerms.length);
  if (requiredPlaceMatches > 0 && countMatches(haystack, uniquePlaceTerms) < requiredPlaceMatches) {
    throw new Error(`Source did not match the requested place well enough: ${url}`);
  }
  if (requiredAffordanceMatches > 0 && countMatches(haystack, uniqueAffordanceTerms) < requiredAffordanceMatches) {
    throw new Error(`Source did not match the requested affordance well enough: ${url}`);
  }
}

async function discoverCandidateUrls(searchQueries: string[]): Promise<string[]> {
  const urls: string[] = [];
  let lastStatus = "not requested";
  for (const searchQuery of searchQueries) {
    const searchUrls = [
      { url: `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(searchQuery)}`, parser: extractDuckDuckGoUrls },
      { url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, parser: extractDuckDuckGoUrls },
      { url: `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}`, parser: extractBingUrls },
    ];
    for (const { url, parser } of searchUrls) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
        });
        lastStatus = `${response.status} from ${url}`;
        if (response.status === 202) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        if (!response.ok) break;
        urls.push(...parser(await response.text()));
        break;
      }
    }
  }
  const candidates = [...new Set(urls)]
    .map((url) => ({
      url,
      score: Math.max(...searchQueries.map((searchQuery) => scoreCandidateUrl(url, searchQuery))),
    }))
    .sort((a, b) => b.score - a.score);
  const best = candidates.slice(0, 10).map((candidate) => candidate.url);
  if (best.length === 0) {
    throw new Error(`No promising candidate URL found in search results. Last search status: ${lastStatus}`);
  }
  return best;
}

async function suggestCandidateUrls(
  workersai: WorkersAiModelFactory,
  query: NormalizedQuery,
  searchQuery: string,
): Promise<string[]> {
  let lastDiscoveryError = "AI-assisted discovery did not run.";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const discovery = await generateObject({
        model: workersai("@cf/moonshotai/kimi-k2.6"),
        schema: CandidateUrlsSchema,
        system:
          "Suggest likely official or authoritative public web URLs that may contain current hours, schedules, event times, or availability information for the user's query. Prefer official organization pages. Do not include search result pages, maps pages, social media, or generic directories.",
        prompt: `User query: "${query.original_user_query}"\nSearch terms: "${searchQuery}"`,
      });
      return discovery.object.urls;
    } catch (error) {
      lastDiscoveryError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(lastDiscoveryError);
}

function htmlToSearchableText(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "AffordanceAtlasBot/0.1 (+https://affordance-atlas-server.andrei-kokoev.workers.dev)" },
  });
  if (!response.ok) {
    throw new Error(`Candidate page fetch failed for ${url}: ${response.status}`);
  }
  const text = htmlToSearchableText(await response.text());
  if (text.length < 100) {
    throw new Error(`Candidate page did not contain enough extractable text: ${url}`);
  }
  return text;
}

function candidateUrlVariants(url: string): string[] {
  try {
    const parsed = new URL(url);
    const origin = `${parsed.origin}/`;
    return parsed.pathname === "/" ? [url] : [url, origin];
  } catch {
    return [url];
  }
}

function buildFallbackExtraction(
  query: NormalizedQuery,
  candidateUrl: string,
  pageText: string,
): z.infer<typeof ExtractedScheduleSchema> {
  const parsedUrl = new URL(candidateUrl);
  const title = pageText.split(/\s(?:-->|\|| - | – )\s/)[0]?.trim() || parsedUrl.hostname;
  const snippets: string[] = [];
  const schedulePattern = /\b[0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)\b|\b(?:hours?|open|opens|closed?|closes|schedule|calendar|admission|mass|market|times?)\b/gi;
  for (const match of pageText.matchAll(schedulePattern)) {
    const index = match.index ?? 0;
    const snippet = pageText
      .slice(Math.max(0, index - 120), Math.min(pageText.length, index + 260))
      .replace(/\s+/g, " ")
      .trim();
    if (!/\b[0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)\b|\b(?:hours?|open|opens|closed?|closes)\b.{0,120}\b[0-9]/i.test(snippet)) continue;
    if (!snippets.includes(snippet)) snippets.push(snippet);
    if (snippets.length >= 3) break;
  }
  const scheduleDescription = snippets.join(" ").slice(0, 800);
  if (scheduleDescription.length < 40) {
    throw new Error(`Could not extract a usable schedule from ${candidateUrl}.`);
  }
  return {
    found: true,
    place_name: title,
    place_address: null,
    affordance_label: query.constraints.affordance.canonical_label ?? query.constraints.affordance.raw_phrase ?? query.original_user_query,
    schedule_description: scheduleDescription,
    recurrence_rule: null,
    recurrence_label: scheduleDescription.slice(0, 180),
    source_url: candidateUrl,
    source_title: title,
    confidence: "candidate",
  };
}

function requireHttpUrl(value: string | null | undefined, fallback: string): string {
  const candidate = value ?? fallback;
  const parsed = new URL(candidate);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Candidate source is not an HTTP(S) URL: ${candidate}`);
  }
  return parsed.toString();
}

function nonBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function compactLabel(value: string | null | undefined, fallback: string, maxLength = 140): string {
  const trimmed = nonBlank(value);
  if (!trimmed) return fallback;
  const normalized = trimmed.replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return fallback;
}

class ResearchCancelledError extends Error {
  constructor() {
    super("Research job was cancelled by the user.");
    this.name = "ResearchCancelledError";
  }
}

async function assertResearchNotCancelled(ctx: ResearchContext, jobId: ResearchJobId): Promise<void> {
  const job = await db.getResearchJob(ctx.db, jobId);
  if (job?.status === "cancelled") throw new ResearchCancelledError();
}

export async function runResearch(
  ctx: ResearchContext,
  jobId: ResearchJobId,
  query: NormalizedQuery,
): Promise<void> {
  const existingJob = await db.getResearchJob(ctx.db, jobId);
  if (existingJob?.status === "cancelled") return;
  await db.updateResearchJobStatus(ctx.db, jobId, { status: "running", scheduledAt: new Date().toISOString() });

  try {
    const searchQueries = buildSearchQueries(query);
    const searchQuery = searchQueries[0] ?? query.original_user_query;
    const workersai = createWorkersAI({ binding: ctx.ai as never });
    let candidateUrls: string[] = suggestNamedPlaceUrls(query);
    let discoveryError = "No search discovery attempted.";
    try {
      candidateUrls = await discoverCandidateUrls(searchQueries);
    } catch (error) {
      discoveryError = error instanceof Error ? error.message : String(error);
    }
    try {
      candidateUrls.push(...await suggestCandidateUrls(workersai, query, searchQuery));
    } catch (error) {
      if (candidateUrls.length === 0) {
        const aiError = error instanceof Error ? error.message : String(error);
        throw new Error(`${discoveryError}; AI-assisted discovery failed: ${aiError}`);
      }
    }
    await assertResearchNotCancelled(ctx, jobId);
    candidateUrls = [...new Set(candidateUrls)].slice(0, 12);
    if (candidateUrls.length === 0) throw new Error(discoveryError);
    let candidateUrl: string | null = null;
    let data: z.infer<typeof ExtractedScheduleSchema> | null = null;
    let lastExtractionError = "No candidates attempted.";
    const attemptedSourceFailures: string[] = [];
    candidateLoop:
    for (const discoveredUrl of candidateUrls) {
      for (const url of candidateUrlVariants(discoveredUrl)) {
        try {
          await assertResearchNotCancelled(ctx, jobId);
          const pageText = await fetchPageText(url);
          assertSourceRelevant(query, url, pageText);
          try {
            const extraction = await generateObject({
              model: workersai("@cf/moonshotai/kimi-k2.6"),
              schema: ExtractedScheduleSchema,
              system:
                "Extract only schedule or availability information grounded in the supplied web page text. Do not invent missing facts. Return found=false when the page does not support the requested affordance, place, and time constraints.",
              prompt:
                `User query: "${query.original_user_query}"\nSource URL: ${url}\n` +
                `Page text (first 24000 chars):\n${pageText.slice(0, 24000)}`,
            });
            data = extraction.object;
          } catch {
            data = buildFallbackExtraction(query, url, pageText);
          }
          if (!nonBlank(data.place_name) || !nonBlank(data.affordance_label) || (!nonBlank(data.schedule_description) && !nonBlank(data.recurrence_label))) {
            data = buildFallbackExtraction(query, url, pageText);
          }
          if (!data.found || data.confidence === "insufficient") {
            data = buildFallbackExtraction(query, url, pageText);
          }
          candidateUrl = url;
          break candidateLoop;
        } catch (error) {
          lastExtractionError = error instanceof Error ? error.message : String(error);
          attemptedSourceFailures.push(`${url}: ${lastExtractionError}`);
          data = null;
          candidateUrl = null;
        }
      }
    }
    if (!data || !candidateUrl) {
      const attempted = attemptedSourceFailures.length > 0
        ? ` Tried sources: ${attemptedSourceFailures.slice(0, 10).join(" | ")}`
        : "";
      throw new Error(`Could not extract a usable schedule from discovered sources: ${lastExtractionError}.${attempted}`);
    }

    await assertResearchNotCancelled(ctx, jobId);
    const sourceUrl = requireHttpUrl(candidateUrl, candidateUrl);
    const sourceHostname = new URL(candidateUrl).hostname;
    const placeName = compactLabel(data.place_name, sourceHostname);
    const affordanceLabel = compactLabel(data.affordance_label, query.original_user_query);
    const recurrenceLabel = nonBlank(data.recurrence_label)?.replace(/\s+/g, " ").slice(0, 240) ?? null;
    const extractedText = nonBlank(data.schedule_description) ?? recurrenceLabel ?? "Extracted availability schedule.";
    const sourceTitle = compactLabel(data.source_title, sourceHostname);

    // 4. Persist extracted data as an AvailabilityClaim
    const now = new Date().toISOString();
    const placeId = `place_${crypto.randomUUID()}` as PlaceId;
    const affordanceId = `aff_${crypto.randomUUID()}` as AffordanceId;
    const claimId = `claim_${crypto.randomUUID()}` as ClaimId;
    const evidenceItemId = `ev_${crypto.randomUUID()}` as EvidenceItemId;
    const answerId = `answer_${crypto.randomUUID()}` as AnswerId;

    await db.insertPlace(ctx.db, {
      placeId,
      canonicalName: placeName,
      address: data.place_address,
    });

    await db.insertAffordance(ctx.db, {
      affordanceId,
      canonicalLabel: affordanceLabel,
      category: "general",
    });

    await db.insertEvidenceItem(ctx.db, {
      evidenceItemId,
      itemClass: "webpage",
      sourceLocator: sourceUrl,
      retrievedAt: now,
      evidenceSpan: extractedText,
      extractedText,
      freshnessState: "current",
    });

    await db.insertAvailabilityClaim(ctx.db, {
      claimId,
      schemaVersion: "0.2.0",
      affordanceId,
      placeId,
      timeScopeJson: JSON.stringify({
        kind: "recurrence",
        timezone: query.timezone,
        starts_at: null,
        ends_at: null,
        recurrence_payload:
          data.recurrence_rule && recurrenceLabel
            ? { recurrence_rule: data.recurrence_rule, recurrence_label: recurrenceLabel }
            : recurrenceLabel
              ? { recurrence_rule: null, recurrence_label: recurrenceLabel }
              : { recurrence_rule: "FREQ=WEEKLY", recurrence_label: extractedText },
        exception_rules: [],
      }),
      claimValidityJson: JSON.stringify({
        valid_from: null,
        valid_through: null,
        validity_basis: `extracted from ${sourceUrl}`,
      }),
      verificationState: "active",
      confidenceState: data.confidence,
      freshnessState: "current",
      contradictionState: "none",
    });

    await db.linkClaimEvidence(ctx.db, claimId, evidenceItemId);

    // 5. Build and store answer
    const answer = buildAnswer({
      answer_id: answerId,
      query_id: query.query_id,
      answer_mode: "asynchronous",
      answer_state: "answered",
      original_user_query: query.original_user_query,
      normalized_query_ref: query.query_id,
      results: [
        {
          result_id: `result_${claimId}`,
          claim_id: claimId,
          affordance_label: affordanceLabel,
          place_label: placeName,
          place_address: data.place_address,
          occurrence: {
            starts_at: null,
            ends_at: null,
            timezone: query.timezone,
            recurrence_label: recurrenceLabel,
          },
          access_conditions: [],
          confidence_state: data.confidence,
          freshness_state: "current",
          verification_state: "candidate",
          contradiction_state: "none",
          evidence_refs: [evidenceItemId],
          evidence: [
            {
              evidence_item_id: evidenceItemId,
              source_url: sourceUrl,
              source_title: sourceTitle,
              retrieved_at: now,
              evidence_span: extractedText,
              extracted_text: extractedText,
              authority_level: "unknown",
              freshness_state: "current",
            },
          ],
          caveats: ["Information was extracted automatically from the web. Verify before relying on it."],
        },
      ],
      answer_summary: `${placeName} offers ${affordanceLabel}${recurrenceLabel ? ` on ${recurrenceLabel}` : ""}.`,
      next_actions: [{ action_type: "verify", label: "Verify the extracted schedule with the venue." }],
    });

    await assertResearchNotCancelled(ctx, jobId);
    await db.insertAnswer(ctx.db, {
      answerId,
      queryId: query.query_id,
      researchJobId: jobId,
      answerMode: "asynchronous",
      answerState: "answered",
      answerJson: JSON.stringify(answer),
      generatedAt: now,
    });

    await db.updateResearchJobStatus(ctx.db, jobId, {
      status: "completed",
      resultAnswerId: answerId,
      completedAt: now,
    });
  } catch (error) {
    if (error instanceof ResearchCancelledError) return;
    const currentJob = await db.getResearchJob(ctx.db, jobId);
    if (currentJob?.status === "cancelled") return;
    const message = error instanceof Error ? error.message : String(error);
    await db.updateResearchJobStatus(ctx.db, jobId, {
      status: "failed",
      errorMessage: message,
      completedAt: new Date().toISOString(),
    });
  }
}
