import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const specPath = path.join(root, "e2e", "visual-snapshots.spec.ts");
const coverageManifestPath = path.join(root, "e2e", "visual-coverage-manifest.json");
const snapshotDir = path.join(root, "e2e-snapshots", "visual");
const outputDir = path.join(root, "e2e-snapshots");
const reportPath = path.join(outputDir, "visual-review-report.json");
const indexPath = path.join(outputDir, "index.html");
const todoPath = path.join(outputDir, "visual-review-todo.md");
const todoJsonPath = path.join(outputDir, "visual-review-todo.json");
const inventoryCoveragePath = path.join(outputDir, "visual-inventory-coverage.json");
const reviewStatusTemplatePath = path.join(outputDir, "visual-review-status.template.json");
const sectionQueuePath = path.join(outputDir, "visual-review-section-queue.json");
const duplicateReviewPath = path.join(outputDir, "visual-review-duplicates.json");
const chatProgressionPath = path.join(outputDir, "visual-review-chat-progression.json");
const chatProgressionHtmlPath = path.join(outputDir, "visual-review-chat-progression.html");
const sectionSheetsDir = path.join(outputDir, "visual-review-sections");
const sectionSheetsIndexPath = path.join(sectionSheetsDir, "index.json");
const sectionSheetsHtmlIndexPath = path.join(sectionSheetsDir, "index.html");
const manualReviewPath = path.join(outputDir, "visual-review-status.json");
const requireManualReview = process.argv.includes("--require-manual-review");

const viewportDimensions = {
  narrow: [320, 740],
  mobile: [390, 844],
  tablet: [768, 1024],
  boundary: [960, 900],
  desktop: [1280, 900],
  wide: [1440, 1000],
};

const viewportNames = Object.keys(viewportDimensions).sort((a, b) => b.length - a.length);

const requiredManualReviewScope = [
  "inventory-state-coverage",
  "responsive-layout",
  "spacing-density-alignment",
  "color-design-system-coherence",
  "text-readability-contrast",
  "interaction-focus-hover-disabled-states",
  "chat-progression-completeness",
  "admin-data-table-usability",
  "error-empty-loading-states",
];

const manualReviewScopeLabels = {
  "inventory-state-coverage": "Inventory state coverage",
  "responsive-layout": "Responsive layout",
  "spacing-density-alignment": "Spacing, density, alignment",
  "color-design-system-coherence": "Color/design-system coherence",
  "text-readability-contrast": "Text readability and contrast",
  "interaction-focus-hover-disabled-states": "Interaction/focus/hover/disabled states",
  "chat-progression-completeness": "Chat progression completeness",
  "admin-data-table-usability": "Admin data-table usability",
  "error-empty-loading-states": "Error/empty/loading states",
};

const chatProgressionRequirements = [
  { key: "empty-start", label: "Empty start before query", states: ["home-empty"] },
  { key: "typed-query", label: "Typed query before submission", states: ["home-typed-query"] },
  { key: "submitted-user-message", label: "Submitted user message only", states: ["chat-submitted-user-only"] },
  { key: "system-lookup-message", label: "System lookup message", states: ["chat-system-looking-only"] },
  { key: "queued-polling", label: "Queued polling state", states: ["chat-queued-polling"] },
  { key: "running-polling", label: "Running polling state", states: ["chat-running-polling"] },
  { key: "active-research", label: "Active research indicator and actions", states: ["chat-active-research", "chat-active-actions-focus"] },
  { key: "reconnecting-during-research", label: "Reconnecting while research is visible", states: ["chat-reconnecting-with-messages"] },
  { key: "offline-during-research", label: "Offline while research is visible", states: ["chat-offline-with-messages"] },
  { key: "cancelled-research", label: "Cancelled research state", states: ["chat-cancelled-research"] },
  { key: "success-answer", label: "Verified success answer", states: ["chat-success-answer"] },
  { key: "multi-result-answer", label: "Multiple-result answer", states: ["chat-multi-result-answer"] },
  { key: "candidate-warning", label: "Candidate or unverified warning", states: ["chat-candidate-warning"] },
  { key: "missing-fields", label: "Missing extracted fields", states: ["chat-missing-fields"] },
  { key: "failure-answer", label: "Research failure answer", states: ["chat-failure"] },
  { key: "technical-failure-details", label: "Expanded technical failure details", states: ["chat-failure-details-expanded"] },
  { key: "unsupported-failure", label: "Unsupported query failure", states: ["chat-unsupported-failure"] },
  { key: "scroll-pressure", label: "Scrollable message stack and top/bottom positions", states: ["chat-scroll-pressure", "chat-scroll-pressure-top", "chat-scroll-pressure-bottom"] },
];


function readVisualStateNames() {
  const spec = fs.readFileSync(specPath, "utf8");
  const start = spec.indexOf("const states: SnapshotState[] = [");
  const end = spec.indexOf("async function expectNoHorizontalOverflow");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Could not locate visual snapshot state array in e2e/visual-snapshots.spec.ts.");
  }
  const statesBlock = spec.slice(start, end);
  const names = [...statesBlock.matchAll(/^\s*\{\s*name:\s*"([^"]+)"/gm)].map((match) => match[1]);
  if (names.length === 0) {
    throw new Error("No visual snapshot states were found.");
  }
  return names;
}

function readCoverageManifest() {
  const manifest = JSON.parse(fs.readFileSync(coverageManifestPath, "utf8"));
  if (manifest.schema !== "affordance-atlas.visual-coverage-manifest.v1") {
    throw new Error("Unsupported visual coverage manifest schema.");
  }
  return manifest;
}

function readInventoryItems(manifest) {
  const inventoryPath = path.resolve(root, manifest.inventory);
  const inventory = fs.readFileSync(inventoryPath, "utf8");
  const excludedSections = new Set(manifest.exclude_inventory_sections ?? []);
  const items = [];
  let section = null;

  for (const line of inventory.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      section = heading[1];
      continue;
    }
    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet && section && !excludedSections.has(section)) {
      items.push({ section, item: bullet[1] });
    }
  }

  return items;
}

function coverageItemsByState() {
  const manifest = readCoverageManifest();
  const itemsByState = new Map();
  for (const entry of manifest.coverage ?? []) {
    for (const state of entry.states ?? []) {
      const items = itemsByState.get(state) ?? [];
      items.push(entry.item);
      itemsByState.set(state, items);
    }
  }
  return itemsByState;
}


function coverageSectionsByState() {
  const manifest = readCoverageManifest();
  const sectionByItem = new Map(readInventoryItems(manifest).map((entry) => [entry.item, entry.section]));
  const sectionsByState = new Map();
  for (const entry of manifest.coverage ?? []) {
    const section = sectionByItem.get(entry.item);
    if (!section) continue;
    for (const state of entry.states ?? []) {
      const sections = sectionsByState.get(state) ?? new Set();
      sections.add(section);
      sectionsByState.set(state, sections);
    }
  }
  return new Map([...sectionsByState.entries()].map(([state, sections]) => [state, [...sections].sort()]));
}

function coverageAudit(stateNames) {
  const manifest = readCoverageManifest();
  const inventoryItems = readInventoryItems(manifest);
  const stateNameSet = new Set(stateNames);
  const coverageByItem = new Map((manifest.coverage ?? []).map((entry) => [entry.item, entry]));
  const inventoryItemSet = new Set(inventoryItems.map((entry) => entry.item));

  const missingCoverage = inventoryItems.filter((entry) => !coverageByItem.has(entry.item));
  const extraCoverage = (manifest.coverage ?? [])
    .filter((entry) => !inventoryItemSet.has(entry.item))
    .map((entry) => entry.item);
  const emptyCoverage = (manifest.coverage ?? [])
    .filter((entry) => !Array.isArray(entry.states) || entry.states.length === 0)
    .map((entry) => entry.item);
  const unknownStateReferences = [];

  for (const entry of manifest.coverage ?? []) {
    for (const state of entry.states ?? []) {
      if (!stateNameSet.has(state)) {
        unknownStateReferences.push({ item: entry.item, state });
      }
    }
  }

  return {
    inventoryItems: inventoryItems.length,
    manifestItems: manifest.coverage?.length ?? 0,
    missingCoverage,
    extraCoverage,
    emptyCoverage,
    unknownStateReferences,
  };
}

function inventoryItemCoverageAudit(stateNames, entries) {
  const manifest = readCoverageManifest();
  const inventoryItems = readInventoryItems(manifest);
  const stateNameSet = new Set(stateNames);
  const entryByFile = new Map(entries.map((entry) => [entry.file, entry]));
  const coverageByItem = new Map((manifest.coverage ?? []).map((entry) => [entry.item, entry]));
  const items = inventoryItems.map((inventoryEntry) => {
    const coverage = coverageByItem.get(inventoryEntry.item);
    const states = coverage?.states ?? [];
    const missingStates = states.filter((state) => !stateNameSet.has(state));
    const files = [];
    const missingFiles = [];
    const viewports = new Set();
    for (const state of states) {
      if (!stateNameSet.has(state)) continue;
      for (const viewport of expectedViewportsFor(state)) {
        const file = state + "-" + viewport + ".png";
        const entry = entryByFile.get(file);
        if (entry) {
          viewports.add(viewport);
          files.push({ file, state, viewport, width: entry.width, height: entry.height, sha256: entry.sha256 });
        } else {
          missingFiles.push(file);
        }
      }
    }
    return {
      section: inventoryEntry.section,
      item: inventoryEntry.item,
      states,
      viewports: [...viewports].sort(),
      fileCount: files.length,
      files,
      missingStates,
      missingFiles,
      complete: !!coverage && states.length > 0 && files.length > 0 && missingStates.length === 0 && missingFiles.length === 0,
    };
  });
  const incompleteItems = items.filter((item) => !item.complete);
  return {
    schema: "affordance-atlas.visual-inventory-coverage.v1",
    generated_at: new Date().toISOString(),
    inventory: manifest.inventory,
    items: items.length,
    completeItems: items.length - incompleteItems.length,
    incompleteItems: incompleteItems.map((item) => ({
      section: item.section,
      item: item.item,
      states: item.states,
      missingStates: item.missingStates,
      missingFiles: item.missingFiles,
      fileCount: item.fileCount,
    })),
    totalFileReferences: items.reduce((sum, item) => sum + item.fileCount, 0),
    sections: [...new Set(items.map((item) => item.section))].sort().map((section) => {
      const sectionItems = items.filter((item) => item.section === section);
      return {
        section,
        items: sectionItems.length,
        completeItems: sectionItems.filter((item) => item.complete).length,
        fileReferences: sectionItems.reduce((sum, item) => sum + item.fileCount, 0),
      };
    }),
    details: items,
    complete: incompleteItems.length === 0,
  };
}

function chatProgressionAudit(stateNames, entries) {
  const stateNameSet = new Set(stateNames);
  const fileSet = new Set(entries.map((entry) => entry.file));
  const stages = chatProgressionRequirements.map((stage) => {
    const missingStates = stage.states.filter((state) => !stateNameSet.has(state));
    const files = [];
    const missingFiles = [];
    for (const state of stage.states) {
      for (const viewport of expectedViewportsFor(state)) {
        const file = state + "-" + viewport + ".png";
        files.push(file);
        if (!fileSet.has(file)) missingFiles.push(file);
      }
    }
    return {
      key: stage.key,
      label: stage.label,
      states: stage.states,
      files,
      fileCount: files.length,
      missingStates,
      missingFiles,
      complete: missingStates.length === 0 && missingFiles.length === 0,
    };
  });
  return {
    requiredStages: chatProgressionRequirements.length,
    completeStages: stages.filter((stage) => stage.complete).length,
    missingStages: stages.filter((stage) => !stage.complete).map((stage) => stage.key),
    expectedFiles: stages.reduce((sum, stage) => sum + stage.fileCount, 0),
    missingFiles: stages.flatMap((stage) => stage.missingFiles),
    missingStates: stages.flatMap((stage) => stage.missingStates),
    stages,
    complete: stages.every((stage) => stage.complete),
  };
}

function pngChunks(buffer) {
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    chunks.push({ type, data: buffer.subarray(dataStart, dataStart + length) });
    offset = dataStart + length + 4;
    if (type === "IEND") break;
  }
  return chunks;
}

function unfilterScanline(filter, row, previous, bytesPerPixel) {
  const output = Buffer.alloc(row.length);
  for (let idx = 0; idx < row.length; idx += 1) {
    const left = idx >= bytesPerPixel ? output[idx - bytesPerPixel] : 0;
    const up = previous ? previous[idx] : 0;
    const upLeft = previous && idx >= bytesPerPixel ? previous[idx - bytesPerPixel] : 0;
    let predictor = 0;
    if (filter === 1) predictor = left;
    if (filter === 2) predictor = up;
    if (filter === 3) predictor = Math.floor((left + up) / 2);
    if (filter === 4) {
      const p = left + up - upLeft;
      const pa = Math.abs(p - left);
      const pb = Math.abs(p - up);
      const pc = Math.abs(p - upLeft);
      predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
    }
    output[idx] = (row[idx] + predictor) & 0xff;
  }
  return output;
}

function pngVisualStats(fileName) {
  const buffer = fs.readFileSync(path.join(snapshotDir, fileName));
  const chunks = pngChunks(buffer);
  const header = chunks.find((chunk) => chunk.type === "IHDR")?.data;
  if (!header) throw new Error(`${fileName} is missing a PNG IHDR chunk.`);

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    return { skipped: true, reason: `Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}` };
  }

  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const stride = width * channels;
  const compressed = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data));
  const inflated = zlib.inflateSync(compressed);
  const histogram = new Map();
  let previous = null;
  let offset = 0;
  let sampled = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[offset];
    const row = inflated.subarray(offset + 1, offset + 1 + stride);
    const decoded = unfilterScanline(filter, row, previous, bytesPerPixel);
    previous = decoded;
    offset += 1 + stride;

    const sampleStep = Math.max(1, Math.floor(width / 160));
    for (let x = 0; x < width; x += sampleStep) {
      const idx = x * channels;
      const r = decoded[idx];
      const g = decoded[idx + 1];
      const b = decoded[idx + 2];
      const bucket = `${r >> 4},${g >> 4},${b >> 4}`;
      histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
      sampled += 1;
    }
  }

  const counts = [...histogram.values()];
  const dominantRatio = Math.max(...counts) / sampled;
  const entropy = counts.reduce((sum, count) => {
    const p = count / sampled;
    return sum - p * Math.log2(p);
  }, 0);

  return {
    skipped: false,
    sampled,
    colorBuckets: histogram.size,
    dominantRatio,
    entropy,
  };
}

function viewportOf(fileName) {
  const baseName = fileName.replace(/\.png$/, "");
  return viewportNames.find((viewport) => baseName.endsWith(`-${viewport}`)) ?? null;
}

function stateOf(fileName) {
  const viewport = viewportOf(fileName);
  if (!viewport) return null;
  return fileName.slice(0, -(".png".length + viewport.length + 1));
}

function pngMetadata(fileName) {
  const buffer = fs.readFileSync(path.join(snapshotDir, fileName));
  if (buffer.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${fileName} is not a PNG file.`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

function snapshotSetSha256(entries) {
  const hash = crypto.createHash("sha256");
  for (const entry of [...entries].sort((a, b) => a.file.localeCompare(b.file))) {
    hash.update(`${entry.file}:${entry.width}x${entry.height}:${entry.sha256}\n`);
  }
  return hash.digest("hex");
}


function expectedViewportsFor(stateName) {
  return stateName.includes("stress-widths") ? ["narrow", "boundary"] : ["mobile", "tablet", "desktop", "wide"];
}

function duplicateRationale(group) {
  const states = new Set(group.map((file) => stateOf(file)));
  const viewports = new Set(group.map((file) => viewportOf(file)));
  if (states.size !== 2 || viewports.size !== 1) return null;

  if (states.has("admin-data-table") && states.has("admin-table-pagination-disabled")) {
    return "Default admin table is also the disabled-previous pagination state; enabled pagination is captured separately.";
  }
  if (states.has("chat-scroll-pressure") && states.has("chat-scroll-pressure-bottom")) {
    return "Default long-stack chat auto-scrolls to bottom; explicit top state is captured separately.";
  }
  if (states.has("chat-job-link-hover") && states.has("chat-many-job-statuses") && viewports.has("mobile")) {
    return "Mobile hover does not persist as a meaningful separate visual state; larger hover viewports are distinct.";
  }

  return null;
}

function emptySectionCounts() {
  return { total: 0, pass: 0, issue: 0, skip: 0, pending: 0 };
}

function manualReviewAudit(entries) {
  const files = new Set(entries.map((entry) => entry.file));
  const reviewFileExists = fs.existsSync(manualReviewPath);
  const reviewFile = reviewFileExists ? JSON.parse(fs.readFileSync(manualReviewPath, "utf8")) : null;
  const statusFileSchemaIssue = reviewFileExists && reviewFile?.schema !== "affordance-atlas.visual-review-status.v1"
    ? `Unsupported or missing review status schema: ${reviewFile?.schema ?? "none"}`
    : null;
  const statusFileGeneratedAt = typeof reviewFile?.generated_at === "string" ? reviewFile.generated_at : "";
  const statusFileGeneratedAtMs = statusFileGeneratedAt ? Date.parse(statusFileGeneratedAt) : NaN;
  const reviewNowWithToleranceMs = Date.now() + 5 * 60 * 1000;
  const statusFileGeneratedAtIssue = reviewFileExists
    && (!statusFileGeneratedAt || Number.isNaN(statusFileGeneratedAtMs) || statusFileGeneratedAtMs > reviewNowWithToleranceMs)
    ? "Missing, invalid, or future-dated review status generated_at timestamp"
    : null;
  const rawScreenshots = reviewFile?.screenshots;
  const statusFileScreenshotsIssue = reviewFileExists
    && (!rawScreenshots || typeof rawScreenshots !== "object" || Array.isArray(rawScreenshots))
    ? "Missing or invalid review status screenshots object"
    : null;
  const screenshots = statusFileScreenshotsIssue ? {} : (rawScreenshots ?? {});
  const expectedScreenshotCount = entries.length;
  const expectedSnapshotSetSha256 = snapshotSetSha256(entries);
  const statusFileScreenshotCountIssue = reviewFileExists && reviewFile?.screenshot_count !== expectedScreenshotCount
    ? `Review status screenshot_count ${reviewFile?.screenshot_count ?? "none"} does not match current screenshot count ${expectedScreenshotCount}`
    : null;
  const statusFileSnapshotSetIssue = reviewFileExists && reviewFile?.snapshot_set_sha256 !== expectedSnapshotSetSha256
    ? "Review status snapshot_set_sha256 does not match current screenshot set"
    : null;
  const scopeReview = reviewFile?.review_scope;
  const statusFileReviewScopeIssue = reviewFileExists
    && (!scopeReview || typeof scopeReview !== "object" || Array.isArray(scopeReview))
    ? "Missing or invalid review_scope object"
    : null;
  const missingReviewScopeItems = reviewFileExists && !statusFileReviewScopeIssue
    ? requiredManualReviewScope.filter((item) => scopeReview[item] !== true)
    : reviewFileExists ? [...requiredManualReviewScope] : [];
  const reviewScopeReviewedAt = typeof reviewFile?.review_scope_reviewed_at === "string" ? reviewFile.review_scope_reviewed_at : "";
  const reviewScopeReviewedAtMs = reviewScopeReviewedAt ? Date.parse(reviewScopeReviewedAt) : NaN;
  const reviewScopeTimestampIssue = reviewFileExists
    && (!reviewScopeReviewedAt || Number.isNaN(reviewScopeReviewedAtMs) || reviewScopeReviewedAtMs > reviewNowWithToleranceMs || (!Number.isNaN(statusFileGeneratedAtMs) && reviewScopeReviewedAtMs > statusFileGeneratedAtMs + 1000))
    ? "Missing, invalid, future-dated, or post-export review_scope_reviewed_at timestamp"
    : null;
  const reviewScopeReviewer = typeof reviewFile?.review_scope_reviewed_by === "string" ? reviewFile.review_scope_reviewed_by.trim() : "";
  const reviewScopeReviewerIssue = reviewFileExists && reviewScopeReviewer.length === 0
    ? "Missing review_scope_reviewed_by reviewer identity"
    : null;
  const counts = { pass: 0, issue: 0, skip: 0, pending: 0 };
  const sectionCounts = new Map();
  function recordSectionStatus(entry, status) {
    for (const section of entry.coverageSections ?? []) {
      const sectionTotal = sectionCounts.get(section) ?? emptySectionCounts();
      sectionTotal.total += 1;
      sectionTotal[status] += 1;
      sectionCounts.set(section, sectionTotal);
    }
  }
  const missing = [];
  const changedFiles = [];
  const skippedWithoutNotes = [];
  const issuesWithoutNotes = [];
  const missingReviewTimestamps = [];
  const temporalIssues = [];
  const missingReviewers = [];
  const invalidStatuses = [];

  for (const entry of entries) {
    const review = screenshots[entry.file];
    if (!review) {
      counts.pending += 1;
      recordSectionStatus(entry, "pending");
      missing.push(entry.file);
      continue;
    }

    const metadataMatches = review.sha256 === entry.sha256
      && review.width === entry.width
      && review.height === entry.height;
    if (!metadataMatches) {
      counts.pending += 1;
      recordSectionStatus(entry, "pending");
      changedFiles.push({
        file: entry.file,
        expected: { sha256: entry.sha256, width: entry.width, height: entry.height },
        reviewed: { sha256: review.sha256 ?? null, width: review.width ?? null, height: review.height ?? null },
      });
      continue;
    }

    const status = review.status ?? "pending";
    const note = typeof review.note === "string" ? review.note.trim() : "";
    if (!["pending", "pass", "issue", "skip"].includes(status)) {
      invalidStatuses.push({ file: entry.file, status });
    }
    if (status === "skip" && note.length === 0) {
      skippedWithoutNotes.push(entry.file);
    }
    if (status === "issue" && note.length === 0) {
      issuesWithoutNotes.push(entry.file);
    }
    if (status === "pass" || status === "issue" || status === "skip") {
      const reviewedAt = typeof review.reviewed_at === "string" ? review.reviewed_at : "";
      const reviewedAtMs = reviewedAt ? Date.parse(reviewedAt) : NaN;
      if (!reviewedAt || Number.isNaN(reviewedAtMs)) {
        missingReviewTimestamps.push(entry.file);
      } else if (reviewedAtMs > reviewNowWithToleranceMs) {
        temporalIssues.push({ file: entry.file, issue: "reviewed_at is future-dated", reviewed_at: reviewedAt });
      } else if (!Number.isNaN(statusFileGeneratedAtMs) && reviewedAtMs > statusFileGeneratedAtMs + 1000) {
        temporalIssues.push({ file: entry.file, issue: "reviewed_at is after review file generated_at", reviewed_at: reviewedAt, generated_at: statusFileGeneratedAt });
      }
      const reviewedBy = typeof review.reviewed_by === "string" ? review.reviewed_by.trim() : "";
      if (reviewedBy.length === 0) {
        missingReviewers.push(entry.file);
      }
      counts[status] += 1;
      recordSectionStatus(entry, status);
    } else {
      counts.pending += 1;
      recordSectionStatus(entry, "pending");
    }
  }

  const staleFiles = Object.keys(screenshots).filter((file) => !files.has(file));
  const sections = [...sectionCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([section, sectionTotal]) => ({ section, ...sectionTotal }));
  return {
    statusFile: reviewFileExists ? path.relative(root, manualReviewPath) : null,
    statusFileSchemaIssue,
    statusFileGeneratedAtIssue,
    statusFileScreenshotsIssue,
    statusFileScreenshotCountIssue,
    statusFileSnapshotSetIssue,
    statusFileReviewScopeIssue,
    reviewScopeTimestampIssue,
    reviewScopeReviewerIssue,
    missingReviewScopeItems,
    requiredReviewScope: requiredManualReviewScope,
    sections,
    sectionsWithPending: sections.filter((section) => section.pending > 0),
    sectionsWithIssues: sections.filter((section) => section.issue > 0),
    expectedScreenshotCount,
    expectedSnapshotSetSha256,
    required: requireManualReview,
    complete: counts.pending === 0
      && counts.issue === 0
      && sections.filter((section) => section.pending > 0).length === 0
      && sections.filter((section) => section.issue > 0).length === 0
      && staleFiles.length === 0
      && changedFiles.length === 0
      && skippedWithoutNotes.length === 0
      && issuesWithoutNotes.length === 0
      && missingReviewTimestamps.length === 0
      && temporalIssues.length === 0
      && missingReviewers.length === 0
      && invalidStatuses.length === 0
      && !statusFileSchemaIssue
      && !statusFileGeneratedAtIssue
      && !statusFileScreenshotsIssue
      && !statusFileScreenshotCountIssue
      && !statusFileSnapshotSetIssue
      && !statusFileReviewScopeIssue
      && !reviewScopeTimestampIssue
      && !reviewScopeReviewerIssue
      && missingReviewScopeItems.length === 0,
    counts,
    missing,
    changedFiles,
    skippedWithoutNotes,
    issuesWithoutNotes,
    missingReviewTimestamps,
    temporalIssues,
    missingReviewers,
    invalidStatuses,
    staleFiles,
  };
}

function buildReport() {
  const stateNames = readVisualStateNames();
  const coverage = coverageAudit(stateNames);
  const expectedNames = new Set(stateNames);
  const files = fs.readdirSync(snapshotDir).filter((file) => file.endsWith(".png")).sort();
  const coverageByState = coverageItemsByState();
  const coverageSectionsByStateMap = coverageSectionsByState();
  const entries = files.map((file) => {
    const state = stateOf(file);
    return {
      file,
      state,
      viewport: viewportOf(file),
      coverageItems: state ? coverageByState.get(state) ?? [] : [],
      coverageSections: state ? coverageSectionsByStateMap.get(state) ?? [] : [],
      ...pngMetadata(file),
    };
  });

  const entriesWithoutCoverage = entries.filter((entry) => entry.coverageItems.length === 0).map((entry) => entry.file);
  const entriesWithoutCoverageSections = entries.filter((entry) => entry.coverageSections.length === 0).map((entry) => entry.file);
  const actualNames = new Set(entries.map((entry) => entry.state).filter(Boolean));
  const missingStates = stateNames.filter((name) => !actualNames.has(name));
  const extraStates = [...actualNames].filter((name) => !expectedNames.has(name));
  const missingFiles = [];

  for (const stateName of stateNames) {
    for (const viewport of expectedViewportsFor(stateName)) {
      const file = `${stateName}-${viewport}.png`;
      if (!files.includes(file)) missingFiles.push(file);
    }
  }

  const byHash = new Map();
  for (const entry of entries) {
    const group = byHash.get(entry.sha256) ?? [];
    group.push(entry.file);
    byHash.set(entry.sha256, group);
  }

  const dimensionIssues = entries
    .filter((entry) => {
      const expected = viewportDimensions[entry.viewport];
      return !expected || entry.width !== expected[0] || entry.height < expected[1];
    })
    .map((entry) => ({
      file: entry.file,
      width: entry.width,
      height: entry.height,
      expectedViewport: entry.viewport ? viewportDimensions[entry.viewport] : null,
    }));

  const visualStats = entries.map((entry) => ({
    file: entry.file,
    ...pngVisualStats(entry.file),
  }));
  const visualQualityIssues = visualStats
    .filter((stats) => !stats.skipped && (stats.colorBuckets < 8 || stats.dominantRatio > 0.998 || stats.entropy < 0.08))
    .map((stats) => ({
      file: stats.file,
      colorBuckets: stats.colorBuckets,
      dominantRatio: Number(stats.dominantRatio.toFixed(5)),
      entropy: Number(stats.entropy.toFixed(5)),
    }));

  const expected = stateNames.reduce((sum, name) => sum + expectedViewportsFor(name).length, 0);
  const duplicates = [...byHash.values()].filter((group) => group.length > 1);
  const duplicateReview = duplicates.map((group) => ({
    files: group,
    rationale: duplicateRationale(group),
  }));

  const report = {
    generated_at: new Date().toISOString(),
    expected,
    actual: files.length,
    states: stateNames.length,
    missingStates,
    extraStates,
    missingFiles,
    extraFiles: entries.filter((entry) => !expectedNames.has(entry.state)).map((entry) => entry.file),
    dimensionIssues,
    visualStats,
    visualQualityIssues,
    entriesWithoutCoverage,
    entriesWithoutCoverageSections,
    inventorySections: [...new Set(entries.flatMap((entry) => entry.coverageSections))].sort(),
    inventoryItemCoverage: inventoryItemCoverageAudit(stateNames, entries),
    tinyFiles: entries.filter((entry) => entry.bytes < 10000),
    duplicates,
    duplicateReview,
    unexpectedDuplicates: duplicateReview.filter((item) => !item.rationale).map((item) => item.files),
    coverage,
    chatProgression: chatProgressionAudit(stateNames, entries),
    manualReview: manualReviewAudit(entries),
    pass: false,
    entries,
  };

  report.reviewTodo = reviewTodoAudit(report);
  report.reviewSectionQueue = reviewSectionQueueAudit(report);
  report.reviewStatusTemplate = reviewStatusTemplateAudit(report);
  report.duplicateReviewArtifact = duplicateReviewArtifactAudit(report);
  report.duplicateAliasActions = duplicateAliasActionsAudit(report);
  report.contactSheetControls = contactSheetControlsAudit(report);
  report.chatProgressionArtifact = chatProgressionArtifactAudit(report);
  report.chatProgressionHtml = chatProgressionHtmlAudit(report);
  report.sectionSheets = sectionSheetsAudit(report);

  report.pass = report.actual === report.expected
    && report.missingStates.length === 0
    && report.extraStates.length === 0
    && report.missingFiles.length === 0
    && report.extraFiles.length === 0
    && report.dimensionIssues.length === 0
    && report.visualQualityIssues.length === 0
    && report.entriesWithoutCoverage.length === 0
    && report.entriesWithoutCoverageSections.length === 0
    && report.inventoryItemCoverage.complete
    && report.reviewTodo.consistencyIssues.length === 0
    && report.reviewSectionQueue.consistencyIssues.length === 0
    && report.reviewStatusTemplate.consistencyIssues.length === 0
    && report.duplicateReviewArtifact.consistencyIssues.length === 0
    && report.duplicateAliasActions.consistencyIssues.length === 0
    && report.contactSheetControls.consistencyIssues.length === 0
    && report.chatProgressionArtifact.consistencyIssues.length === 0
    && report.chatProgressionHtml.consistencyIssues.length === 0
    && report.sectionSheets.consistencyIssues.length === 0
    && report.chatProgression.complete
    && report.tinyFiles.length === 0
    && report.unexpectedDuplicates.length === 0
    && report.coverage.missingCoverage.length === 0
    && report.coverage.extraCoverage.length === 0
    && report.coverage.emptyCoverage.length === 0
    && report.coverage.unknownStateReferences.length === 0
    && (!requireManualReview || report.manualReview.complete);

  return report;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reviewStatusForEntry(entry, manualReview) {
  const changed = manualReview.changedFiles.some((item) => item.file === entry.file);
  if (changed) return "pending";
  if (manualReview.missing.includes(entry.file)) return "pending";
  const current = fs.existsSync(manualReviewPath) ? JSON.parse(fs.readFileSync(manualReviewPath, "utf8")) : null;
  const review = current?.screenshots?.[entry.file];
  if (!review || review.sha256 !== entry.sha256 || review.width !== entry.width || review.height !== entry.height) return "pending";
  return ["pass", "issue", "skip"].includes(review.status) ? review.status : "pending";
}

function buildReviewStatusTemplate(report) {
  const reviewScope = Object.fromEntries(requiredManualReviewScope.map((item) => [item, false]));
  return {
    schema: "affordance-atlas.visual-review-status.v1",
    template_schema: "affordance-atlas.visual-review-status-template.v1",
    generated_at: report.generated_at,
    screenshot_count: report.actual,
    snapshot_set_sha256: report.manualReview.expectedSnapshotSetSha256,
    review_scope: reviewScope,
    review_scope_reviewed_at: "",
    review_scope_reviewed_by: "",
    screenshots: Object.fromEntries(report.entries.map((entry) => [entry.file, {
      state: entry.state,
      viewport: entry.viewport,
      sections: entry.coverageSections,
      width: entry.width,
      height: entry.height,
      sha256: entry.sha256,
      status: "pending",
      note: "",
      reviewed_at: "",
      reviewed_by: "",
    }])),
  };
}

function reviewStatusTemplateAudit(report) {
  const template = buildReviewStatusTemplate(report);
  const screenshotFiles = Object.keys(template.screenshots);
  const pendingScreenshots = screenshotFiles.filter((file) => template.screenshots[file].status === "pending").length;
  const consistencyIssues = [];
  if (template.schema !== "affordance-atlas.visual-review-status.v1") {
    consistencyIssues.push("Review status template uses the wrong status schema");
  }
  if (template.screenshot_count !== report.actual) {
    consistencyIssues.push("Review status template screenshot_count does not match report actual count");
  }
  if (screenshotFiles.length !== report.actual) {
    consistencyIssues.push("Review status template screenshots object does not contain one entry per screenshot");
  }
  if (pendingScreenshots !== report.actual) {
    consistencyIssues.push("Review status template must leave every screenshot pending");
  }
  if (template.snapshot_set_sha256 !== report.manualReview.expectedSnapshotSetSha256) {
    consistencyIssues.push("Review status template snapshot_set_sha256 does not match current screenshot set");
  }
  const scopeItems = Object.keys(template.review_scope);
  const missingScopeItems = requiredManualReviewScope.filter((item) => template.review_scope[item] !== false);
  if (scopeItems.length !== requiredManualReviewScope.length || missingScopeItems.length > 0) {
    consistencyIssues.push("Review status template review_scope must contain every required item initialized to false");
  }
  return {
    path: path.relative(root, reviewStatusTemplatePath),
    screenshots: screenshotFiles.length,
    pendingScreenshots,
    scopeItems: scopeItems.length,
    consistencyIssues,
  };
}

function writeReviewStatusTemplate(report) {
  fs.writeFileSync(reviewStatusTemplatePath, JSON.stringify(buildReviewStatusTemplate(report), null, 2) + "\n");
}

function buildChatProgressionArtifact(report) {
  const entriesByFile = new Map(report.entries.map((entry) => [entry.file, entry]));
  const stages = report.chatProgression.stages.map((stage, index) => ({
    order: index + 1,
    key: stage.key,
    label: stage.label,
    complete: stage.complete,
    states: stage.states,
    missingStates: stage.missingStates,
    missingFiles: stage.missingFiles,
    files: stage.files.map((file, fileIndex) => {
      const entry = entriesByFile.get(file);
      return {
        order: fileIndex + 1,
        file,
        present: !!entry,
        state: entry?.state ?? stateOf(file),
        viewport: entry?.viewport ?? viewportOf(file),
        width: entry?.width ?? null,
        height: entry?.height ?? null,
        sha256: entry?.sha256 ?? null,
        anchor: shotAnchor(file),
        contactSheetHref: contactSheetHref(file),
        screenshotHref: screenshotHref(file),
        coverageSections: entry?.coverageSections ?? [],
        coverageItems: entry?.coverageItems ?? [],
      };
    }),
  }));
  return {
    schema: "affordance-atlas.visual-review-chat-progression.v1",
    generated_at: report.generated_at,
    source_report: path.relative(root, reportPath),
    contact_sheet: path.relative(root, indexPath),
    visual_sheet: path.relative(root, chatProgressionHtmlPath),
    screenshot_directory: path.relative(root, snapshotDir),
    strict_gate: "pnpm --filter @affordance-atlas/web audit:visual:manual",
    summary: {
      required_stages: report.chatProgression.requiredStages,
      complete_stages: report.chatProgression.completeStages,
      expected_files: report.chatProgression.expectedFiles,
      missing_stages: report.chatProgression.missingStages.length,
      missing_files: report.chatProgression.missingFiles.length,
      missing_states: report.chatProgression.missingStates.length,
      complete: report.chatProgression.complete,
    },
    stages,
  };
}

function chatProgressionArtifactAudit(report) {
  const artifact = buildChatProgressionArtifact(report);
  const consistencyIssues = [];
  if (artifact.summary.required_stages !== report.chatProgression.requiredStages) {
    consistencyIssues.push("Chat progression artifact stage count does not match audit stage count");
  }
  if (artifact.summary.complete_stages !== report.chatProgression.completeStages) {
    consistencyIssues.push("Chat progression artifact complete stage count does not match audit complete count");
  }
  if (artifact.summary.expected_files !== report.chatProgression.expectedFiles) {
    consistencyIssues.push("Chat progression artifact expected file count does not match audit file count");
  }
  if (artifact.summary.missing_files !== report.chatProgression.missingFiles.length) {
    consistencyIssues.push("Chat progression artifact missing file count does not match audit missing files");
  }
  if (artifact.summary.missing_states !== report.chatProgression.missingStates.length) {
    consistencyIssues.push("Chat progression artifact missing state count does not match audit missing states");
  }
  if (artifact.summary.complete !== report.chatProgression.complete) {
    consistencyIssues.push("Chat progression artifact completion flag does not match audit completion flag");
  }
  if (artifact.stages.length !== report.chatProgression.stages.length) {
    consistencyIssues.push("Chat progression artifact stage list does not match audit stages");
  }
  for (const stage of artifact.stages) {
    const auditStage = report.chatProgression.stages.find((item) => item.key === stage.key);
    if (!auditStage) {
      consistencyIssues.push("Chat progression artifact contains unknown stage " + stage.key);
      continue;
    }
    if (stage.files.length !== auditStage.fileCount) {
      consistencyIssues.push("Chat progression artifact file count does not match audit file count for " + stage.key);
    }
    for (const item of stage.files) {
      if (!item.contactSheetHref || !item.screenshotHref || !item.anchor) {
        consistencyIssues.push("Chat progression artifact item is missing review links for " + item.file);
      }
      if (item.present && !fs.existsSync(path.join(root, item.screenshotHref))) {
        consistencyIssues.push("Chat progression artifact screenshot link does not resolve for " + item.file);
      }
    }
  }
  return {
    path: path.relative(root, chatProgressionPath),
    stages: artifact.summary.required_stages,
    completeStages: artifact.summary.complete_stages,
    expectedFiles: artifact.summary.expected_files,
    missingStages: artifact.summary.missing_stages,
    missingFiles: artifact.summary.missing_files,
    consistencyIssues,
  };
}

function writeChatProgressionArtifact(report) {
  fs.writeFileSync(chatProgressionPath, JSON.stringify(buildChatProgressionArtifact(report), null, 2) + "\n");
}

function chatStageAnchor(stage) {
  return "chat-stage-" + stage.key.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildChatProgressionHtml(report) {
  const artifact = buildChatProgressionArtifact(report);
  const css = "body{font-family:system-ui,Segoe UI,sans-serif;margin:24px;background:#f8fafc;color:#111827}a{color:#1d4ed8;text-decoration:none}a:hover{text-decoration:underline}.meta{color:#475569}.stage-nav{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;padding:10px;margin:16px 0;background:#fff;border:1px solid #dbe3ee;border-radius:8px}.stage{scroll-margin-top:88px;margin:22px 0;padding:16px;background:#fff;border:1px solid #dbe3ee;border-radius:8px}.stage h2{font-size:18px;margin:0 0 6px}.stage-meta{font-size:12px;color:#475569;margin:0 0 12px}.shot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.shot{border:1px solid #e5e7eb;border-radius:8px;padding:8px;background:#fff}.shot img{display:block;width:100%;height:auto;border:1px solid #e5e7eb;background:white}.shot-title{font-size:12px;font-weight:650;word-break:break-all;margin:8px 0 2px}.shot-meta{font-size:11px;color:#64748b}.coverage{font-size:11px;color:#475569;margin-top:6px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:11px}";
  const nav = artifact.stages.map((stage) => `<a href="#${escapeHtml(chatStageAnchor(stage))}">${stage.order}. ${escapeHtml(stage.label)}</a>`).join("");
  const sections = artifact.stages.map((stage) => {
    const stateText = stage.states.join(", ");
    const images = stage.files.map((item) => {
      const coverage = item.coverageItems.length > 0 ? `<div class="coverage">Covers ${item.coverageItems.length} inventory item${item.coverageItems.length === 1 ? "" : "s"}</div>` : `<div class="coverage">No mapped inventory items.</div>`;
      return `<article class="shot"><img src="visual/${escapeHtml(item.file)}" alt="${escapeHtml(stage.label + " / " + item.viewport)}"><div class="shot-title">${escapeHtml(item.file)}</div><div class="shot-meta">${escapeHtml(item.viewport)} / ${item.width ?? "missing"} x ${item.height ?? "missing"}</div><div class="actions"><a href="index.html#${escapeHtml(item.anchor)}">Main sheet</a><a href="visual/${escapeHtml(item.file)}" target="_blank" rel="noopener">PNG</a></div>${coverage}</article>`;
    }).join("");
    return `<section id="${escapeHtml(chatStageAnchor(stage))}" class="stage"><h2>${stage.order}. ${escapeHtml(stage.label)}</h2><p class="stage-meta">Key: ${escapeHtml(stage.key)} / States: ${escapeHtml(stateText)} / Complete: ${stage.complete}</p><div class="shot-grid">${images}</div></section>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><title>Affordance Atlas Chat Progression Review</title><style>${css}</style><h1>Affordance Atlas Chat Progression Review</h1><p class="meta">${artifact.summary.complete_stages} of ${artifact.summary.required_stages} stages complete. ${artifact.summary.expected_files} progression screenshots, ${artifact.summary.missing_files} missing files, ${artifact.summary.missing_states} missing states. Generated ${escapeHtml(artifact.generated_at)}.</p><p class="meta"><a href="index.html">Main contact sheet</a> / <a href="visual-review-chat-progression.json">Machine-readable chat progression JSON</a></p><nav class="stage-nav">${nav}</nav>${sections}`;
}

function chatProgressionHtmlAudit(report) {
  const artifact = buildChatProgressionArtifact(report);
  const html = buildChatProgressionHtml(report);
  const consistencyIssues = [];
  for (const stage of artifact.stages) {
    if (!html.includes(`id="${chatStageAnchor(stage)}"`)) {
      consistencyIssues.push("Chat progression HTML missing stage anchor for " + stage.key);
    }
    for (const item of stage.files) {
      if (!html.includes(`src="visual/${item.file}"`)) {
        consistencyIssues.push("Chat progression HTML missing image reference for " + item.file);
      }
      if (!html.includes(`href="index.html#${item.anchor}"`)) {
        consistencyIssues.push("Chat progression HTML missing main-sheet link for " + item.file);
      }
    }
  }
  return {
    path: path.relative(root, chatProgressionHtmlPath),
    stageAnchors: artifact.stages.length,
    imageReferences: artifact.stages.reduce((sum, stage) => sum + stage.files.length, 0),
    consistencyIssues,
  };
}

function writeChatProgressionHtml(report) {
  fs.writeFileSync(chatProgressionHtmlPath, buildChatProgressionHtml(report));
}

function shotAnchor(file) {
  return "shot-" + file.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function contactSheetHref(file) {
  return path.relative(root, indexPath) + "#" + shotAnchor(file);
}

function screenshotHref(file) {
  return path.relative(root, path.join(snapshotDir, file));
}

function reviewTodoItem(entry, status) {
  return {
    file: entry.file,
    state: entry.state,
    viewport: entry.viewport,
    width: entry.width,
    height: entry.height,
    sha256: entry.sha256,
    status,
    anchor: shotAnchor(entry.file),
    contactSheetHref: contactSheetHref(entry.file),
    screenshotHref: screenshotHref(entry.file),
    coverageSections: entry.coverageSections,
    coverageItems: entry.coverageItems,
  };
}

function sectionSlug(section) {
  return section.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function sectionSheetHref(section) {
  return path.relative(root, path.join(sectionSheetsDir, sectionSlug(section) + ".html"));
}

function buildSectionSheetIndex(report) {
  const entriesWithStatus = report.entries.map((entry) => ({
    entry,
    status: reviewStatusForEntry(entry, report.manualReview),
  }));
  const sections = report.manualReview.sections.map((section, index) => {
    const items = entriesWithStatus
      .filter((item) => item.entry.coverageSections.includes(section.section))
      .map((item, itemIndex) => ({
        order: itemIndex + 1,
        ...reviewTodoItem(item.entry, item.status),
      }));
    return {
      order: index + 1,
      section: section.section,
      slug: sectionSlug(section.section),
      html: sectionSheetHref(section.section),
      total: section.total,
      pass: section.pass,
      issue: section.issue,
      skip: section.skip,
      pending: section.pending,
      imageReferences: items.length,
      items,
    };
  });
  return {
    schema: "affordance-atlas.visual-review-section-sheets.v1",
    generated_at: report.generated_at,
    source_report: path.relative(root, reportPath),
    contact_sheet: path.relative(root, indexPath),
    visual_index: path.relative(root, sectionSheetsHtmlIndexPath),
    summary: {
      sections: sections.length,
      image_references: sections.reduce((sum, section) => sum + section.imageReferences, 0),
      pending_references: sections.reduce((sum, section) => sum + section.pending, 0),
      issue_references: sections.reduce((sum, section) => sum + section.issue, 0),
    },
    sections,
  };
}

function buildSectionSheetHtml(section, index, report) {
  const css = "body{font-family:system-ui,Segoe UI,sans-serif;margin:24px;background:#f8fafc;color:#111827}a{color:#1d4ed8;text-decoration:none}a:hover{text-decoration:underline}.meta{color:#475569}.toolbar,.scope{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px;margin:16px 0;background:#fff;border:1px solid #dbe3ee;border-radius:8px}.scope{position:static}.toolbar input,.toolbar select,.toolbar button{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#111827;padding:6px 8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.shot{border:1px solid #e5e7eb;border-radius:8px;padding:8px;background:#fff}.shot[data-status=pass]{border-color:#86efac}.shot[data-status=issue]{border-color:#fca5a5}.shot[data-status=skip]{opacity:.72}.shot img{display:block;width:100%;height:auto;border:1px solid #e5e7eb;background:white}.name{font-size:12px;font-weight:650;word-break:break-all;margin:8px 0 2px}.dims,.status,.count{font-size:11px;color:#64748b}.coverage{font-size:11px;color:#475569;margin-top:6px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:11px}.review{display:grid;gap:6px;margin-top:8px}.review select,.review textarea{font:inherit;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:6px}.review textarea{min-height:44px;resize:vertical}";
  const metadata = Object.fromEntries(section.items.map((item) => [item.file, { state: item.state, viewport: item.viewport, sections: item.coverageSections, width: item.width, height: item.height, sha256: item.sha256 }]));
  const scopeChecks = requiredManualReviewScope.map((item) => '<label><input type="checkbox" data-scope="' + item + '"> ' + escapeHtml(manualReviewScopeLabels[item] ?? item) + '</label>').join("");
  const nav = index.sections.map((item) => '<a href="' + escapeHtml(path.basename(item.html)) + '">' + item.order + '. ' + escapeHtml(item.section) + '</a>').join("");
  const viewportOptions = [...new Set(section.items.map((item) => item.viewport))].sort((a, b) => a.localeCompare(b)).map((viewport) => '<option value="' + escapeHtml(viewport) + '">' + escapeHtml(viewport) + '</option>').join("");
  const cards = section.items.map((item) => {
    const coverage = item.coverageItems.length > 0 ? '<div class="coverage">' + item.coverageItems.map((coverageItem) => escapeHtml(coverageItem)).join("<br>") + '</div>' : '<div class="coverage">No mapped inventory items.</div>';
    return '<article class="shot" data-file="' + escapeHtml(item.file) + '" data-status="' + escapeHtml(item.status) + '" data-viewport="' + escapeHtml(item.viewport) + '"><img src="../visual/' + escapeHtml(item.file) + '" alt="' + escapeHtml(section.section + ' / ' + item.viewport) + '"><div class="name">' + escapeHtml(item.file) + '</div><div class="dims">' + escapeHtml(item.viewport) + ' / ' + item.width + ' x ' + item.height + '</div><div class="status">Status: <span data-current-status>' + escapeHtml(item.status) + '</span></div><div class="actions"><a href="../index.html#' + escapeHtml(item.anchor) + '">Main sheet</a><a href="../visual/' + escapeHtml(item.file) + '" target="_blank" rel="noopener">PNG</a></div>' + coverage + '<div class="review"><select aria-label="Review status for ' + escapeHtml(item.file) + '"><option value="pending">Pending review</option><option value="pass">Pass</option><option value="issue">Issue found</option><option value="skip">Skipped/alias</option></select><textarea aria-label="Review note for ' + escapeHtml(item.file) + '" placeholder="Review note"></textarea></div></article>';
  }).join("");
  const js = [
    "const key='affordance-atlas.visual-review.v1';",
    "const scopeKey=key+'.scope';",
    "const reviewerKey=key+'.reviewer';",
    "const metadata=" + JSON.stringify(metadata) + ";",
    "const state=JSON.parse(localStorage.getItem(key)||'{}');",
    "const scopeState=JSON.parse(localStorage.getItem(scopeKey)||'{}');",
    "const shots=[...document.querySelectorAll('.shot')];",
    "const reviewerInput=document.querySelector('#section-reviewer');",
    "let pendingCursor=-1;",
    "reviewerInput.value=localStorage.getItem(reviewerKey)||'';",
    "function reviewerName(){return reviewerInput.value.trim();}",
    "function isCurrent(file,item){const current=metadata[file];return !!item&&!!current&&item.sha256===current.sha256&&item.width===current.width&&item.height===current.height;}",
    "function currentReview(file,overrides){return {...metadata[file],...(state[file]||{}),...overrides};}",
    "function save(){localStorage.setItem(key,JSON.stringify(state));render();}",
    "function saveScope(){localStorage.setItem(scopeKey,JSON.stringify(scopeState));render();}",
    "function render(){const q=document.querySelector('#section-filter').value.toLowerCase();const statusFilter=document.querySelector('#section-status').value;const viewportFilter=document.querySelector('#section-viewport').value;let visible=0,pass=0,issue=0,skip=0,pending=0,stale=0,skipNeedsNote=0,issueNeedsNote=0,reviewerMissing=0;for(const input of document.querySelectorAll('[data-scope]')) input.checked=scopeState[input.dataset.scope]===true;const scopeMissing=[...document.querySelectorAll('[data-scope]')].filter(input=>!input.checked).length;for(const shot of shots){const file=shot.dataset.file;const item=state[file]||{};const fresh=isCurrent(file,item);const status=fresh?item.status||'pending':'pending';if(item.status&&!fresh)stale++;if(fresh&&status==='skip'&&!(typeof item.note==='string'&&item.note.trim()))skipNeedsNote++;if(fresh&&status==='issue'&&!(typeof item.note==='string'&&item.note.trim()))issueNeedsNote++;if(fresh&&['pass','issue','skip'].includes(status)&&!(typeof item.reviewed_by==='string'&&item.reviewed_by.trim()))reviewerMissing++;shot.dataset.status=status;shot.querySelector('select').value=status;shot.querySelector('textarea').value=item.note||'';shot.querySelector('[data-current-status]').textContent=status;if(status==='pass')pass++;else if(status==='issue')issue++;else if(status==='skip')skip++;else pending++;const show=(q===''||shot.innerText.toLowerCase().includes(q))&&(statusFilter==='all'||status===statusFilter)&&(viewportFilter==='all'||shot.dataset.viewport===viewportFilter);shot.classList.toggle('hidden',!show);if(show)visible++;}const warnings=[];if(stale)warnings.push(stale+' stale');if(skipNeedsNote)warnings.push(skipNeedsNote+' skipped need notes');if(issueNeedsNote)warnings.push(issueNeedsNote+' issues need notes');if(reviewerMissing)warnings.push(reviewerMissing+' reviewed need reviewer');if(scopeMissing)warnings.push(scopeMissing+' scope checks pending');document.querySelector('#section-counts').textContent=visible+' visible / '+shots.length+' total; '+pass+' pass, '+issue+' issue, '+skip+' skipped, '+pending+' pending in this section'+(warnings.length?'; '+warnings.join(', '):'');}",
    "document.addEventListener('change',event=>{if(event.target.matches('[data-scope]')){scopeState[event.target.dataset.scope]=event.target.checked;saveScope();return;}const shot=event.target.closest('.shot');if(!shot||event.target.tagName!=='SELECT')return;const status=event.target.value;state[shot.dataset.file]=currentReview(shot.dataset.file,{status,reviewed_at:status==='pending'?'':new Date().toISOString(),reviewed_by:status==='pending'?'':reviewerName()});save();});",
    "document.addEventListener('input',event=>{if(event.target.id==='section-filter'){pendingCursor=-1;return render();}if(event.target.id==='section-reviewer'){localStorage.setItem(reviewerKey,reviewerName());return;}const shot=event.target.closest('.shot');if(!shot||event.target.tagName!=='TEXTAREA')return;state[shot.dataset.file]=currentReview(shot.dataset.file,{note:event.target.value});localStorage.setItem(key,JSON.stringify(state));render();});",
    "document.querySelector('#section-export').addEventListener('click',()=>{const generatedAt=new Date().toISOString();const data={schema:'affordance-atlas.visual-review-status.v1',generated_at:generatedAt,screenshot_count:" + report.actual + ",snapshot_set_sha256:'" + report.manualReview.expectedSnapshotSetSha256 + "',review_scope:scopeState,review_scope_reviewed_at:generatedAt,review_scope_reviewed_by:reviewerName(),screenshots:state};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='visual-review-status.json';a.click();URL.revokeObjectURL(a.href);});",
    "document.querySelector('#section-import').addEventListener('change',async event=>{const file=event.target.files&&event.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||data.schema!=='affordance-atlas.visual-review-status.v1')throw new Error('Expected review status schema affordance-atlas.visual-review-status.v1.');if(data.screenshot_count!==" + report.actual + ")throw new Error('Review file screenshot_count does not match this section sheet.');if(data.snapshot_set_sha256!=='" + report.manualReview.expectedSnapshotSetSha256 + "')throw new Error('Review file snapshot_set_sha256 does not match this section sheet.');if(!data.screenshots||typeof data.screenshots!=='object'||Array.isArray(data.screenshots))throw new Error('Expected a screenshots object.');if(!data.review_scope||typeof data.review_scope!=='object'||Array.isArray(data.review_scope))throw new Error('Expected a review_scope object.');for(const [name,value]of Object.entries(data.review_scope))scopeState[name]=value===true;localStorage.setItem(scopeKey,JSON.stringify(scopeState));for(const [name,item]of Object.entries(data.screenshots)){if(!item||typeof item!=='object')continue;const status=['pending','pass','issue','skip'].includes(item.status)?item.status:'pending';state[name]={...item,status,note:typeof item.note==='string'?item.note:''};}save();}catch(error){alert('Could not import review JSON: '+error.message);}finally{event.target.value='';}});",
    "document.querySelector('#section-status').addEventListener('change',()=>{pendingCursor=-1;render();});",
    "document.querySelector('#section-viewport').addEventListener('change',()=>{pendingCursor=-1;render();});",
    "document.querySelector('#section-next-pending').addEventListener('click',()=>{const pending=shots.filter(shot=>!shot.classList.contains('hidden')&&shot.dataset.status==='pending');if(pending.length===0)return;pendingCursor=(pendingCursor+1)%pending.length;pending[pendingCursor].scrollIntoView({behavior:'smooth',block:'start'});});",
    "render();",
  ].join("");
  const script = '<script>' + js + '</script>';
  return '<!doctype html><meta charset="utf-8"><title>Affordance Atlas Section Review - ' + escapeHtml(section.section) + '</title><style>' + css + '</style><h1>' + escapeHtml(section.section) + '</h1><p class="meta">' + section.imageReferences + ' screenshot references. ' + section.pass + ' pass, ' + section.issue + ' issue, ' + section.skip + ' skipped, ' + section.pending + ' pending. Generated ' + escapeHtml(index.generated_at) + '.</p><p class="meta"><a href="../index.html">Main contact sheet</a> / <a href="index.json">Section sheet index JSON</a></p><nav class="toolbar">' + nav + '</nav><div class="toolbar"><input id="section-filter" type="search" placeholder="Filter section"><select id="section-status" aria-label="Review status filter"><option value="all">All statuses</option><option value="pending">Pending</option><option value="pass">Pass</option><option value="issue">Issue</option><option value="skip">Skipped</option></select><select id="section-viewport" aria-label="Viewport filter"><option value="all">All viewports</option>' + viewportOptions + '</select><label>Reviewer <input id="section-reviewer" type="text" placeholder="Reviewer name"></label><button id="section-next-pending" type="button">Next pending</button><button id="section-export" type="button">Export review JSON</button><label>Import review JSON <input id="section-import" type="file" accept="application/json"></label><span id="section-counts" class="count"></span></div><section class="scope"><strong>Required review scope</strong>' + scopeChecks + '</section><main class="grid">' + cards + '</main>' + script;
}

function buildSectionSheetsIndexHtml(index) {
  const css = "body{font-family:system-ui,Segoe UI,sans-serif;margin:24px;background:#f8fafc;color:#111827}a{color:#1d4ed8;text-decoration:none}a:hover{text-decoration:underline}.meta{color:#475569}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.card{display:block;background:#fff;border:1px solid #dbe3ee;border-radius:8px;padding:12px}.card strong{display:block;margin-bottom:6px}.count{font-size:12px;color:#64748b}";
  const cards = index.sections.map((section) => `<a class="card" href="${escapeHtml(path.basename(section.html))}"><strong>${section.order}. ${escapeHtml(section.section)}</strong><span class="count">${section.imageReferences} references / ${section.pending} pending / ${section.issue} issues</span></a>`).join("");
  return `<!doctype html><meta charset="utf-8"><title>Affordance Atlas Section Review Sheets</title><style>${css}</style><h1>Affordance Atlas Section Review Sheets</h1><p class="meta">${index.summary.sections} sections, ${index.summary.image_references} screenshot references. Generated ${escapeHtml(index.generated_at)}. <a href="../index.html">Main contact sheet</a></p><main class="grid">${cards}</main>`;
}

function sectionSheetsAudit(report) {
  const index = buildSectionSheetIndex(report);
  const consistencyIssues = [];
  if (index.sections.length !== report.manualReview.sections.length) {
    consistencyIssues.push("Section sheets index section count does not match manual review section count");
  }
  const expectedReferences = report.manualReview.sections.reduce((sum, section) => sum + section.total, 0);
  if (index.summary.image_references !== expectedReferences) {
    consistencyIssues.push("Section sheets image reference count does not match manual review section total");
  }
  const indexHtml = buildSectionSheetsIndexHtml(index);
  const slugs = new Set();
  let scopeControlReferences = 0;
  let exportSchemaReferences = 0;
  let exportSnapshotSetReferences = 0;
  let exportScreenshotCountReferences = 0;
  let importControlReferences = 0;
  let importGuardReferences = 0;
  let warningSummaryReferences = 0;
  let nextPendingReferences = 0;
  let filterControlReferences = 0;
  for (const section of index.sections) {
    if (slugs.has(section.slug)) {
      consistencyIssues.push("Section sheets contain duplicate slug " + section.slug);
    }
    slugs.add(section.slug);
    if (!indexHtml.includes(`href="${section.slug}.html"`)) {
      consistencyIssues.push("Section sheets HTML index missing link for " + section.section);
    }
    if (section.imageReferences !== section.total || section.items.length !== section.total) {
      consistencyIssues.push("Section sheet item count does not match section total for " + section.section);
    }
    const html = buildSectionSheetHtml(section, index, report);
    if (!html.includes('id="section-reviewer"') || !html.includes('id="section-export"')) {
      consistencyIssues.push("Section sheet missing review export controls for " + section.section);
    }
    if (html.includes('id="section-import"')) {
      importControlReferences += 1;
    } else {
      consistencyIssues.push("Section sheet missing review import control for " + section.section);
    }
    if (html.includes("Expected review status schema affordance-atlas.visual-review-status.v1") && html.includes("Review file screenshot_count does not match this section sheet") && html.includes("Review file snapshot_set_sha256 does not match this section sheet") && html.includes("Expected a screenshots object") && html.includes("Expected a review_scope object")) {
      importGuardReferences += 1;
    } else {
      consistencyIssues.push("Section sheet missing guarded review import validation for " + section.section);
    }
    if (html.includes("stale") && html.includes("skipped need notes") && html.includes("issues need notes") && html.includes("reviewed need reviewer") && html.includes("scope checks pending")) {
      warningSummaryReferences += 1;
    } else {
      consistencyIssues.push("Section sheet missing review warning summary markers for " + section.section);
    }
    if (html.includes('id="section-next-pending"') && html.includes("pendingCursor") && html.includes("scrollIntoView")) {
      nextPendingReferences += 1;
    } else {
      consistencyIssues.push("Section sheet missing next-pending navigation for " + section.section);
    }
    if (html.includes('id="section-filter"') && html.includes('id="section-status"') && html.includes('id="section-viewport"') && html.includes("classList.toggle('hidden',!show)")) {
      filterControlReferences += 1;
    } else {
      consistencyIssues.push("Section sheet missing local filter controls for " + section.section);
    }
    for (const scopeItem of requiredManualReviewScope) {
      if (html.includes('data-scope="' + scopeItem + '"')) {
        scopeControlReferences += 1;
      } else {
        consistencyIssues.push("Section sheet missing required review scope control " + scopeItem + " for " + section.section);
      }
    }
    if (html.includes("schema:'affordance-atlas.visual-review-status.v1'")) {
      exportSchemaReferences += 1;
    } else {
      consistencyIssues.push("Section sheet missing strict review export schema marker for " + section.section);
    }
    if (html.includes("snapshot_set_sha256:'" + report.manualReview.expectedSnapshotSetSha256 + "'")) {
      exportSnapshotSetReferences += 1;
    } else {
      consistencyIssues.push("Section sheet missing current snapshot-set export hash for " + section.section);
    }
    if (html.includes("screenshot_count:" + report.actual)) {
      exportScreenshotCountReferences += 1;
    } else {
      consistencyIssues.push("Section sheet missing current screenshot-count export marker for " + section.section);
    }
    for (const item of section.items) {
      if (!html.includes('src="../visual/' + item.file + '"')) {
        consistencyIssues.push("Section sheet missing image reference for " + item.file + " in " + section.section);
      }
      if (!html.includes('href="../index.html#' + item.anchor + '"')) {
        consistencyIssues.push("Section sheet missing main-sheet link for " + item.file + " in " + section.section);
      }
      if (!html.includes('href="../visual/' + item.file + '"')) {
        consistencyIssues.push("Section sheet missing direct PNG link for " + item.file + " in " + section.section);
      }
      if (!html.includes('aria-label="Review status for ' + item.file + '"') || !html.includes('aria-label="Review note for ' + item.file + '"')) {
        consistencyIssues.push("Section sheet missing review fields for " + item.file + " in " + section.section);
      }
      if (!fs.existsSync(path.join(root, item.screenshotHref))) {
        consistencyIssues.push("Section sheet screenshot link does not resolve for " + item.file);
      }
    }
  }
  return {
    path: path.relative(root, sectionSheetsIndexPath),
    sections: index.summary.sections,
    imageReferences: index.summary.image_references,
    pendingReferences: index.summary.pending_references,
    issueReferences: index.summary.issue_references,
    indexLinks: index.sections.filter((section) => indexHtml.includes(`href="${section.slug}.html"`)).length,
    scopeControlReferences,
    exportSchemaReferences,
    exportSnapshotSetReferences,
    exportScreenshotCountReferences,
    importControlReferences,
    importGuardReferences,
    warningSummaryReferences,
    nextPendingReferences,
    filterControlReferences,
    consistencyIssues,
  };
}

function writeSectionSheets(report) {
  const index = buildSectionSheetIndex(report);
  fs.mkdirSync(sectionSheetsDir, { recursive: true });
  for (const section of index.sections) {
    fs.writeFileSync(path.join(sectionSheetsDir, section.slug + ".html"), buildSectionSheetHtml(section, index, report));
  }
  fs.writeFileSync(sectionSheetsIndexPath, JSON.stringify(index, null, 2) + "\n");
  fs.writeFileSync(sectionSheetsHtmlIndexPath, buildSectionSheetsIndexHtml(index));
}

function buildReviewTodoModel(report) {
  const entriesWithStatus = report.entries.map((entry) => ({
    entry,
    status: reviewStatusForEntry(entry, report.manualReview),
  }));
  const isPendingOrIssue = (item) => item.status === "pending" || item.status === "issue";
  return {
    schema: "affordance-atlas.visual-review-todo.v1",
    generated_at: report.generated_at,
    source_report: path.relative(root, reportPath),
    contact_sheet: path.relative(root, indexPath),
    screenshot_directory: path.relative(root, snapshotDir),
    strict_gate: "pnpm --filter @affordance-atlas/web audit:visual:manual",
    summary: {
      screenshots: report.actual,
      inventory_sections: report.manualReview.sections.length,
      pending_screenshots: report.manualReview.counts.pending,
      issue_screenshots: report.manualReview.counts.issue,
      sections_with_pending: report.manualReview.sectionsWithPending.length,
      sections_with_issues: report.manualReview.sectionsWithIssues.length,
    },
    unique: entriesWithStatus
      .filter(isPendingOrIssue)
      .map((item) => reviewTodoItem(item.entry, item.status)),
    sections: report.manualReview.sections.map((section) => ({
      section: section.section,
      total: section.total,
      pass: section.pass,
      issue: section.issue,
      skip: section.skip,
      pending: section.pending,
      items: entriesWithStatus
        .filter((item) => item.entry.coverageSections.includes(section.section))
        .filter(isPendingOrIssue)
        .map((item) => reviewTodoItem(item.entry, item.status)),
    })),
  };
}

function reviewTodoLinkAudit(todo) {
  const issues = [];
  const allItems = [
    ...todo.unique,
    ...todo.sections.flatMap((section) => section.items),
  ];
  for (const item of allItems) {
    const expectedAnchor = shotAnchor(item.file);
    const expectedContactHref = contactSheetHref(item.file);
    const expectedScreenshotHref = screenshotHref(item.file);
    if (item.anchor !== expectedAnchor) {
      issues.push("Todo anchor mismatch for " + item.file);
    }
    if (item.contactSheetHref !== expectedContactHref) {
      issues.push("Todo contact-sheet href mismatch for " + item.file);
    }
    if (item.screenshotHref !== expectedScreenshotHref) {
      issues.push("Todo screenshot href mismatch for " + item.file);
    }
    if (!fs.existsSync(path.join(root, expectedScreenshotHref))) {
      issues.push("Todo screenshot href does not resolve to an existing file for " + item.file);
    }
  }
  return {
    itemReferences: allItems.length,
    contactSheetLinks: allItems.filter((item) => item.contactSheetHref === contactSheetHref(item.file)).length,
    screenshotLinks: allItems.filter((item) => item.screenshotHref === screenshotHref(item.file)).length,
    issues,
  };
}

function buildReviewSectionQueue(report) {
  const todo = buildReviewTodoModel(report);
  const sections = todo.sections.map((section, sectionIndex) => ({
    section: section.section,
    order: sectionIndex + 1,
    total: section.total,
    pass: section.pass,
    issue: section.issue,
    skip: section.skip,
    pending: section.pending,
    remaining: section.items.length,
    next: section.items[0] ?? null,
    items: section.items.map((item, index) => ({
      order: index + 1,
      ...item,
    })),
  }));
  return {
    schema: "affordance-atlas.visual-review-section-queue.v1",
    generated_at: report.generated_at,
    source_report: path.relative(root, reportPath),
    contact_sheet: path.relative(root, indexPath),
    todo_json: path.relative(root, todoJsonPath),
    strict_gate: "pnpm --filter @affordance-atlas/web audit:visual:manual",
    summary: {
      sections: sections.length,
      sections_with_remaining: sections.filter((section) => section.remaining > 0).length,
      remaining_references: sections.reduce((sum, section) => sum + section.remaining, 0),
      pending_screenshots: report.manualReview.counts.pending,
      issue_screenshots: report.manualReview.counts.issue,
    },
    sections,
  };
}

function reviewSectionQueueAudit(report) {
  const queue = buildReviewSectionQueue(report);
  const expectedRemainingReferences = report.manualReview.sections.reduce((sum, section) => sum + section.pending + section.issue, 0);
  const consistencyIssues = [];
  if (queue.sections.length !== report.manualReview.sections.length) {
    consistencyIssues.push("Section queue section count does not match manual review section count");
  }
  if (queue.summary.remaining_references !== expectedRemainingReferences) {
    consistencyIssues.push("Section queue remaining references do not match section pending+issue total");
  }
  if (queue.summary.sections_with_remaining !== report.manualReview.sectionsWithPending.length + report.manualReview.sectionsWithIssues.filter((issueSection) => !report.manualReview.sectionsWithPending.some((pendingSection) => pendingSection.section === issueSection.section)).length) {
    consistencyIssues.push("Section queue remaining section count does not match manual review pending/issue sections");
  }
  for (const section of queue.sections) {
    if (section.remaining > 0 && !section.next) {
      consistencyIssues.push("Section queue missing next item for " + section.section);
    }
    for (const item of section.items) {
      if (!item.contactSheetHref || !item.screenshotHref || !item.anchor) {
        consistencyIssues.push("Section queue item is missing review links for " + item.file);
      }
    }
  }
  return {
    path: path.relative(root, sectionQueuePath),
    sections: queue.summary.sections,
    sectionsWithRemaining: queue.summary.sections_with_remaining,
    remainingReferences: queue.summary.remaining_references,
    consistencyIssues,
  };
}

function writeReviewSectionQueue(report) {
  fs.writeFileSync(sectionQueuePath, JSON.stringify(buildReviewSectionQueue(report), null, 2) + "\n");
}

function reviewTodoAudit(report) {
  const todo = buildReviewTodoModel(report);
  const jsonUniquePendingOrIssue = todo.unique.length;
  const jsonSectionPendingOrIssueReferences = todo.sections.reduce((sum, section) => sum + section.items.length, 0);
  const expectedUniquePendingOrIssue = report.manualReview.counts.pending + report.manualReview.counts.issue;
  const expectedSectionPendingOrIssueReferences = report.manualReview.sections.reduce((sum, section) => sum + section.pending + section.issue, 0);
  const consistencyIssues = [];
  const linkAudit = reviewTodoLinkAudit(todo);
  consistencyIssues.push(...linkAudit.issues);
  if (jsonUniquePendingOrIssue !== expectedUniquePendingOrIssue) {
    consistencyIssues.push("Todo unique count " + jsonUniquePendingOrIssue + " does not match manual pending+issue count " + expectedUniquePendingOrIssue);
  }
  if (jsonSectionPendingOrIssueReferences !== expectedSectionPendingOrIssueReferences) {
    consistencyIssues.push("Todo section reference count " + jsonSectionPendingOrIssueReferences + " does not match section pending+issue total " + expectedSectionPendingOrIssueReferences);
  }
  if (todo.summary.screenshots !== report.actual) {
    consistencyIssues.push("Todo summary screenshot count does not match audit report actual screenshot count");
  }
  if (todo.summary.inventory_sections !== report.manualReview.sections.length) {
    consistencyIssues.push("Todo summary inventory section count does not match manual review section count");
  }
  return {
    path: path.relative(root, todoPath),
    jsonPath: path.relative(root, todoJsonPath),
    uniquePendingOrIssue: jsonUniquePendingOrIssue,
    sectionPendingOrIssueReferences: jsonSectionPendingOrIssueReferences,
    jsonUniquePendingOrIssue,
    jsonSectionPendingOrIssueReferences,
    linkItemReferences: linkAudit.itemReferences,
    contactSheetLinks: linkAudit.contactSheetLinks,
    screenshotLinks: linkAudit.screenshotLinks,
    expectedUniquePendingOrIssue,
    expectedSectionPendingOrIssueReferences,
    expectedSectionsWithPending: report.manualReview.sectionsWithPending.length,
    expectedSectionsWithIssues: report.manualReview.sectionsWithIssues.length,
    consistencyIssues,
  };
}

function buildDuplicateReviewArtifact(report) {
  const entriesByFile = new Map(report.entries.map((entry) => [entry.file, entry]));
  const groups = report.duplicateReview.map((group, index) => {
    const files = [...group.files].sort();
    const canonical = files[0] ?? null;
    return {
      order: index + 1,
      files,
      canonical,
      aliases: files.filter((file) => file !== canonical),
      rationale: group.rationale,
      skip_note: group.rationale ? "Intentional duplicate alias: " + group.rationale : "Unexpected duplicate; investigate before approving.",
      entries: files.map((file) => {
        const entry = entriesByFile.get(file);
        return {
          file,
          state: entry?.state ?? stateOf(file),
          viewport: entry?.viewport ?? viewportOf(file),
          width: entry?.width ?? null,
          height: entry?.height ?? null,
          sha256: entry?.sha256 ?? null,
          anchor: shotAnchor(file),
          contactSheetHref: contactSheetHref(file),
          screenshotHref: screenshotHref(file),
          coverageSections: entry?.coverageSections ?? [],
          coverageItems: entry?.coverageItems ?? [],
        };
      }),
    };
  });
  return {
    schema: "affordance-atlas.visual-review-duplicates.v1",
    generated_at: report.generated_at,
    source_report: path.relative(root, reportPath),
    contact_sheet: path.relative(root, indexPath),
    summary: {
      groups: groups.length,
      classified_groups: groups.filter((group) => !!group.rationale).length,
      unexpected_groups: groups.filter((group) => !group.rationale).length,
      duplicate_files: groups.reduce((sum, group) => sum + group.files.length, 0),
      alias_files: groups.reduce((sum, group) => sum + group.aliases.length, 0),
    },
    groups,
  };
}

function duplicateAliasActionsAudit(report) {
  const entryByFile = new Map(report.entries.map((entry) => [entry.file, entry]));
  const actions = report.duplicateReview.flatMap((group) => group.files.slice(1).map((file) => ({
    file,
    note: group.rationale ? "Intentional duplicate alias: " + group.rationale : "Unexpected duplicate; investigate before approving.",
  })));
  const consistencyIssues = [];
  for (const action of actions) {
    if (!entryByFile.has(action.file)) {
      consistencyIssues.push("Duplicate alias action file is not a current screenshot: " + action.file);
    }
    if (typeof action.note !== "string" || action.note.trim().length === 0) {
      consistencyIssues.push("Duplicate alias action missing skip note for " + action.file);
    }
  }
  return {
    actionFiles: actions.length,
    consistencyIssues,
  };
}

function contactSheetControlsAudit(report) {
  const html = buildContactSheetHtml(report);
  const sectionNames = [...new Set(report.entries.flatMap((entry) => entry.coverageSections))].sort();
  const viewportFilters = ["mobile", "tablet", "desktop", "wide", "narrow", "boundary"];
  const statusOptions = ["pending", "pass", "issue", "skip"];
  const toolbarControlIds = ["filter", "status", "viewport", "section", "zoom", "reviewer", "next-pending", "export", "import", "clear"];
  const consistencyIssues = [];
  const markerCount = (pattern) => (html.match(pattern) || []).length;
  const hasAll = (items, predicate) => items.filter((item) => predicate(item)).length;

  const toolbarControls = hasAll(toolbarControlIds, (id) => html.includes('id="' + id + '"'));
  const statusOptionReferences = hasAll(statusOptions, (status) => html.includes('value="' + status + '"'));
  const viewportFilterOptions = hasAll(viewportFilters, (viewport) => html.includes('value="' + viewport + '"'));
  const sectionFilterOptions = hasAll(sectionNames, (section) => html.includes('<option value="' + escapeHtml(section) + '">' + escapeHtml(section) + '</option>'));
  const zoomOptions = hasAll(["small", "medium", "large", "full"], (zoom) => html.includes('value="' + zoom + '"'));
  const scopeControlReferences = markerCount(/data-scope=/g);
  const reviewStatusControls = markerCount(/aria-label="Review status for /g);
  const reviewNoteControls = markerCount(/aria-label="Review note for /g);
  const exportSchemaReferences = markerCount(/schema:'affordance-atlas\.visual-review-status\.v1'/g);
  const exportSnapshotSetReferences = markerCount(new RegExp("snapshot_set_sha256:'" + report.manualReview.expectedSnapshotSetSha256.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "'", "g"));
  const exportScreenshotCountReferences = markerCount(new RegExp("screenshot_count:" + report.actual, "g"));
  const importControlReferences = html.includes('id="import"') ? 1 : 0;
  const importGuardReferences = [
    "Expected review status schema affordance-atlas.visual-review-status.v1",
    "Review file screenshot_count does not match this contact sheet",
    "Review file snapshot_set_sha256 does not match this contact sheet",
    "Expected a screenshots object",
    "Expected a review_scope object",
  ].filter((marker) => html.includes(marker)).length;
  const warningSummaryReferences = ["stale review records", "skipped need notes", "issues need notes", "reviewed need reviewer", "review-scope checks pending"].filter((marker) => html.includes(marker)).length === 5 ? 1 : 0;
  const nextPendingReferences = html.includes('id="next-pending"') && html.includes("pendingCursor") && html.includes("scrollIntoView") ? 1 : 0;
  const duplicateAliasActionFiles = html.includes('data-skip-duplicate-aliases') && html.includes("const duplicateAliasActions=") ? report.duplicateAliasActions.actionFiles : 0;

  if (toolbarControls !== toolbarControlIds.length) consistencyIssues.push("Contact sheet missing one or more toolbar controls");
  if (statusOptionReferences !== statusOptions.length) consistencyIssues.push("Contact sheet missing one or more status options");
  if (viewportFilterOptions !== viewportFilters.length) consistencyIssues.push("Contact sheet missing one or more viewport filter options");
  if (sectionFilterOptions !== sectionNames.length) consistencyIssues.push("Contact sheet section filter count does not match generated section options");
  if (sectionNames.length !== report.manualReview.sections.length) consistencyIssues.push("Contact sheet section filter count does not match manual review section count");
  if (zoomOptions !== 4) consistencyIssues.push("Contact sheet missing one or more zoom options");
  if (scopeControlReferences !== requiredManualReviewScope.length) consistencyIssues.push("Contact sheet required scope control count does not match manual review scope");
  if (reviewStatusControls !== report.actual) consistencyIssues.push("Contact sheet review status control count does not match screenshot count");
  if (reviewNoteControls !== report.actual) consistencyIssues.push("Contact sheet review note control count does not match screenshot count");
  if (exportSchemaReferences < 1 || exportSnapshotSetReferences < 1 || exportScreenshotCountReferences < 1) consistencyIssues.push("Contact sheet missing strict export schema, snapshot-set hash, or screenshot-count marker");
  if (importControlReferences !== 1 || importGuardReferences !== 5) consistencyIssues.push("Contact sheet missing guarded review import controls");
  if (warningSummaryReferences !== 1) consistencyIssues.push("Contact sheet missing review warning summary markers");
  if (nextPendingReferences !== 1) consistencyIssues.push("Contact sheet missing next-pending navigation markers");
  if (duplicateAliasActionFiles !== report.duplicateReviewArtifact.aliasFiles) consistencyIssues.push("Contact sheet duplicate-alias action count does not match duplicate review alias count");

  return {
    path: path.relative(root, indexPath),
    toolbarControls,
    filterControls: hasAll(["filter", "status", "viewport", "section"], (id) => html.includes('id="' + id + '"')),
    statusOptions: statusOptionReferences,
    viewportFilterOptions,
    sectionFilterOptions,
    zoomOptions,
    scopeControlReferences,
    reviewStatusControls,
    reviewNoteControls,
    exportSchemaReferences,
    exportSnapshotSetReferences,
    exportScreenshotCountReferences,
    importControlReferences,
    importGuardReferences,
    warningSummaryReferences,
    nextPendingReferences,
    duplicateAliasActionFiles,
    consistencyIssues,
  };
}

function duplicateReviewArtifactAudit(report) {
  const artifact = buildDuplicateReviewArtifact(report);
  const consistencyIssues = [];
  if (artifact.summary.groups !== report.duplicateReview.length) {
    consistencyIssues.push("Duplicate artifact group count does not match duplicate review group count");
  }
  if (artifact.summary.unexpected_groups !== report.unexpectedDuplicates.length) {
    consistencyIssues.push("Duplicate artifact unexpected group count does not match audit unexpected duplicate count");
  }
  for (const group of artifact.groups) {
    if (!group.canonical || group.aliases.length !== Math.max(0, group.files.length - 1)) {
      consistencyIssues.push("Duplicate artifact group has invalid canonical/alias split");
    }
    if (!group.rationale) {
      consistencyIssues.push("Duplicate artifact group lacks rationale for " + group.files.join(", "));
    }
    for (const entry of group.entries) {
      if (!entry.contactSheetHref || !entry.screenshotHref || !entry.anchor || !fs.existsSync(path.join(root, entry.screenshotHref))) {
        consistencyIssues.push("Duplicate artifact entry has invalid links for " + entry.file);
      }
    }
  }
  return {
    path: path.relative(root, duplicateReviewPath),
    groups: artifact.summary.groups,
    classifiedGroups: artifact.summary.classified_groups,
    unexpectedGroups: artifact.summary.unexpected_groups,
    duplicateFiles: artifact.summary.duplicate_files,
    aliasFiles: artifact.summary.alias_files,
    consistencyIssues,
  };
}

function writeDuplicateReviewArtifact(report) {
  fs.writeFileSync(duplicateReviewPath, JSON.stringify(buildDuplicateReviewArtifact(report), null, 2) + "\n");
}

function writeInventoryCoverage(report) {
  const payload = {
    ...report.inventoryItemCoverage,
    generated_at: report.generated_at,
    source_report: path.relative(root, reportPath),
    screenshot_directory: path.relative(root, snapshotDir),
  };
  fs.writeFileSync(inventoryCoveragePath, JSON.stringify(payload, null, 2) + "\n");
}

function writeReviewTodo(report) {
  const todo = buildReviewTodoModel(report);
  const lines = [
    "# UI Snapshot Manual Review Todo",
    "",
    "Generated: " + todo.generated_at,
    "",
    "This file is generated by `pnpm --filter @affordance-atlas/web audit:visual`. It is a navigation aid for the required manual review; the authoritative pass/fail gate remains `pnpm --filter @affordance-atlas/web audit:visual:manual`.",
    "",
    "Machine-readable todo: `" + path.relative(root, todoJsonPath) + "`",
    "",
    "## Summary",
    "",
    "- Screenshots: " + todo.summary.screenshots,
    "- Inventory sections: " + todo.summary.inventory_sections,
    "- Pending screenshots: " + todo.summary.pending_screenshots,
    "- Issue screenshots: " + todo.summary.issue_screenshots,
    "- Sections with pending screenshots: " + todo.summary.sections_with_pending,
    "- Sections with issue screenshots: " + todo.summary.sections_with_issues,
    "",
    "## Unique Screenshot Checklist",
    "",
  ];

  for (const item of todo.unique) {
    lines.push("- [ ] " + item.status.toUpperCase() + ": [`" + item.file + "`](" + item.contactSheetHref + ") ([PNG](" + item.screenshotHref + "), " + item.width + " x " + item.height + ", " + item.viewport + ")");
  }
  lines.push("");
  lines.push("## Sections");
  lines.push("");

  for (const section of todo.sections) {
    lines.push("### " + section.section);
    lines.push("");
    lines.push("- Total: " + section.total);
    lines.push("- Pass: " + section.pass);
    lines.push("- Issue: " + section.issue);
    lines.push("- Skip: " + section.skip);
    lines.push("- Pending: " + section.pending);
    lines.push("");
    if (section.items.length === 0) {
      lines.push("- No pending or issue screenshots in this section.");
    } else {
      for (const item of section.items) {
        lines.push("- [ ] " + item.status.toUpperCase() + ": [`" + item.file + "`](" + item.contactSheetHref + ") ([PNG](" + item.screenshotHref + "), " + item.width + " x " + item.height + ", " + item.viewport + ")");
      }
    }
    lines.push("");
  }

  fs.writeFileSync(todoPath, lines.join("\n") + "\n");
}

function writeReviewTodoJson(report) {
  fs.writeFileSync(todoJsonPath, JSON.stringify(buildReviewTodoModel(report), null, 2) + "\n");
}

function buildContactSheetHtml(report) {
  const css = "body{font-family:system-ui,Segoe UI,sans-serif;margin:24px;background:#f8fafc;color:#111827}h1{font-size:22px;margin:0 0 8px}.meta{margin:0 0 20px;color:#475569}.toolbar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px;margin:0 0 16px;background:#fff;border:1px solid #dbe3ee;border-radius:8px;box-shadow:0 1px 3px rgb(17 24 39 / .08)}.toolbar input,.toolbar select,.toolbar button,.import-label{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#111827;padding:6px 8px}.toolbar button,.import-label{cursor:pointer}.import-label input{position:absolute;inline-size:1px;block-size:1px;opacity:0;pointer-events:none} .reviewer-label{display:flex;gap:6px;align-items:center;font-size:13px;color:#475569}.reviewer-label input{min-width:150px}.count{font-size:13px;color:#475569}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--shot-min,260px),1fr));gap:16px}.grid[data-zoom=medium]{--shot-min:360px}.grid[data-zoom=large]{--shot-min:520px}.grid[data-zoom=full]{--shot-min:min(960px,100%)}.shot{scroll-margin-top:96px;background:white;border:1px solid #dbe3ee;border-radius:8px;padding:10px}.shot[data-status='pass']{border-color:#86efac}.shot[data-status='issue']{border-color:#fca5a5}.shot[data-status='skip']{border-color:#cbd5e1;opacity:.72}.shot img{width:100%;height:auto;border:1px solid #e5e7eb;background:white}.name{font-size:12px;font-weight:650;word-break:break-all;margin:8px 0 2px}.dims{font-size:11px;color:#64748b}.shot-actions{display:flex;gap:8px;margin-top:6px;font-size:11px}.shot-actions a{color:#1d4ed8;text-decoration:none}.shot-actions a:hover{text-decoration:underline}.review{display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px}.review textarea{min-height:44px;resize:vertical;font:inherit;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:6px}.review select{font:inherit;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:6px}.coverage{margin-top:8px;font-size:11px;color:#475569}.coverage summary{cursor:pointer;font-weight:650}.coverage ul{margin:6px 0 0 18px;padding:0}.coverage li{margin:3px 0}.dupes,.scope,.section-progress{background:#fff;border:1px solid #dbe3ee;border-radius:8px;padding:12px;margin:16px 0}.dupes{background:#fff7ed;border-color:#fed7aa}.dupes code{font-size:12px}.scope div{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:8px}.scope-check{font-size:12px;color:#334155}.section-progress table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}.section-progress th,.section-progress td{border-top:1px solid #e5e7eb;padding:6px 8px;text-align:right}.section-progress th:first-child,.section-progress td:first-child{text-align:left}.hidden{display:none!important}";
  const reviewMetadata = Object.fromEntries(report.entries.map((entry) => [entry.file, {
    state: entry.state,
    viewport: entry.viewport,
    sections: entry.coverageSections,
    width: entry.width,
    height: entry.height,
    sha256: entry.sha256,
  }]));
  const duplicateAliasActions = report.duplicateReview.flatMap((group) => {
    const note = group.rationale ? "Intentional duplicate alias: " + group.rationale : "Unexpected duplicate; investigate before approving.";
    return group.files.slice(1).map((file) => ({ file, note }));
  });
  const scopeChecks = requiredManualReviewScope.map((item) => `<label class="scope-check"><input type="checkbox" data-scope="${item}"> ${escapeHtml(manualReviewScopeLabels[item] ?? item)}</label>`).join("");
  const sectionOptions = [...new Set(report.entries.flatMap((entry) => entry.coverageSections))]
    .sort((a, b) => a.localeCompare(b))
    .map((section) => `<option value="${escapeHtml(section)}">${escapeHtml(section)}</option>`)
    .join("");
  const reviewScript = `
<script>
const key='affordance-atlas.visual-review.v1';
const metadata=${JSON.stringify(reviewMetadata)};
const duplicateAliasActions=${JSON.stringify(duplicateAliasActions)};
const state=JSON.parse(localStorage.getItem(key)||'{}');
const scopeKey=key+'.scope';
const scopeState=JSON.parse(localStorage.getItem(scopeKey)||'{}');
const reviewerKey=key+'.reviewer';
const zoomKey=key+'.zoom';
const shots=[...document.querySelectorAll('.shot')];
let pendingCursor=-1;
const grid=document.querySelector('.grid');
const zoomInput=document.querySelector('#zoom');
const reviewerInput=document.querySelector('#reviewer');
const sectionProgressBody=document.querySelector('#section-progress tbody');
reviewerInput.value=localStorage.getItem(reviewerKey)||'';
zoomInput.value=localStorage.getItem(zoomKey)||'small';
function reviewerName(){return reviewerInput.value.trim();}
function isCurrent(file,item){
  const current=metadata[file];
  return !!item&&!!current&&item.sha256===current.sha256&&item.width===current.width&&item.height===current.height;
}
function currentReview(file,overrides){return {...metadata[file],...(state[file]||{}),...overrides};}
function save(){localStorage.setItem(key,JSON.stringify(state));render();}
function saveScope(){localStorage.setItem(scopeKey,JSON.stringify(scopeState));render();}
function render(){
  const q=document.querySelector('#filter').value.toLowerCase();
  const status=document.querySelector('#status').value;
  const viewport=document.querySelector('#viewport').value;
  const section=document.querySelector('#section').value;
  grid.dataset.zoom=zoomInput.value;
  let visible=0, pass=0, issue=0, skip=0, pending=0, stale=0, skipNeedsNote=0, issueNeedsNote=0, reviewerMissing=0;
  const sectionTotals=new Map();
  for(const input of document.querySelectorAll('[data-scope]')) input.checked=scopeState[input.dataset.scope]===true;
  const scopeMissing=[...document.querySelectorAll('[data-scope]')].filter(input=>!input.checked).length;
  for(const shot of shots){
    const file=shot.dataset.file;
    const shotSections=(shot.dataset.sections||'').split('||').filter(Boolean);
    const item=state[file]||{};
    const fresh=isCurrent(file,item);
    const s=fresh ? item.status||'pending' : 'pending';
    if(item.status&&!fresh) stale++;
    if(fresh&&s==='skip'&&!(typeof item.note==='string'&&item.note.trim())) skipNeedsNote++;
    if(fresh&&s==='issue'&&!(typeof item.note==='string'&&item.note.trim())) issueNeedsNote++;
    if(fresh&&['pass','issue','skip'].includes(s)&&!(typeof item.reviewed_by==='string'&&item.reviewed_by.trim())) reviewerMissing++;
    shot.dataset.status=s;
    shot.querySelector('select').value=s;
    shot.querySelector('textarea').value=item.note||'';
    if(s==='pass') pass++; else if(s==='issue') issue++; else if(s==='skip') skip++; else pending++;
    for(const sectionName of shotSections){
      const totals=sectionTotals.get(sectionName)||{total:0,pass:0,issue:0,skip:0,pending:0};
      totals.total++; totals[s]++; sectionTotals.set(sectionName,totals);
    }
    const matchText=shot.innerText.toLowerCase().includes(q);
    const matchStatus=status==='all'||s===status;
    const matchViewport=viewport==='all'||shot.dataset.viewport===viewport;
    const matchSection=section==='all'||shotSections.includes(section);
    const show=matchText&&matchStatus&&matchViewport&&matchSection;
    shot.classList.toggle('hidden',!show);
    if(show) visible++;
  }
  const staleText=stale ? ', '+stale+' stale review records need re-review' : '';
  const skipNoteText=skipNeedsNote ? ', '+skipNeedsNote+' skipped need notes' : '';
  const issueNoteText=issueNeedsNote ? ', '+issueNeedsNote+' issues need notes' : '';
  const reviewerText=reviewerMissing ? ', '+reviewerMissing+' reviewed need reviewer' : '';
  const scopeText=scopeMissing ? ', '+scopeMissing+' review-scope checks pending' : '';
  document.querySelector('#counts').textContent=visible+' visible / '+shots.length+' total; '+pass+' pass, '+issue+' issue, '+skip+' skipped, '+pending+' pending'+staleText+skipNoteText+issueNoteText+reviewerText+scopeText;
  if(sectionProgressBody){
    sectionProgressBody.replaceChildren(...[...sectionTotals.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,totals])=>{
      const tr=document.createElement('tr');
      for(const value of [name,totals.total,totals.pass,totals.issue,totals.skip,totals.pending]){
        const td=document.createElement('td');
        td.textContent=String(value);
        tr.appendChild(td);
      }
      return tr;
    }));
  }
}
document.addEventListener('change',event=>{
  if(event.target.matches('[data-scope]')){scopeState[event.target.dataset.scope]=event.target.checked;saveScope();return;}
  const shot=event.target.closest('.shot');
  if(!shot||event.target.tagName!=='SELECT') return;
  const status=event.target.value;
  const reviewedAt=status==='pending' ? "" : new Date().toISOString();
  state[shot.dataset.file]=currentReview(shot.dataset.file,{status,reviewed_at:reviewedAt,reviewed_by:status==='pending'?'':reviewerName()});
  save();
});
document.addEventListener('input',event=>{
  if(event.target.id==='filter'||event.target.id==='status') return render();
  const shot=event.target.closest('.shot');
  if(!shot||event.target.tagName!=='TEXTAREA') return;
  state[shot.dataset.file]=currentReview(shot.dataset.file,{note:event.target.value});
  localStorage.setItem(key,JSON.stringify(state));
});
document.querySelector('#export').addEventListener('click',()=>{
  const generatedAt=new Date().toISOString();
  const data={schema:'affordance-atlas.visual-review-status.v1',generated_at:generatedAt,screenshot_count:${report.actual},snapshot_set_sha256:'${report.manualReview.expectedSnapshotSetSha256}',review_scope:scopeState,review_scope_reviewed_at:generatedAt,review_scope_reviewed_by:reviewerName(),screenshots:state};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='visual-review-status.json';a.click();URL.revokeObjectURL(a.href);
});
document.querySelector('#import').addEventListener('change',async event=>{
  const file=event.target.files&&event.target.files[0];
  if(!file) return;
  try{
    const data=JSON.parse(await file.text());
    if(!data||data.schema!=='affordance-atlas.visual-review-status.v1') throw new Error('Expected review status schema affordance-atlas.visual-review-status.v1.');
    if(data.screenshot_count!==${report.actual}) throw new Error('Review file screenshot_count does not match this contact sheet.');
    if(data.snapshot_set_sha256!=='${report.manualReview.expectedSnapshotSetSha256}') throw new Error('Review file snapshot_set_sha256 does not match this contact sheet.');
    if(!data||typeof data.screenshots!=='object'||Array.isArray(data.screenshots)) throw new Error('Expected a screenshots object.');
    if(!data.review_scope||typeof data.review_scope!=='object'||Array.isArray(data.review_scope)) throw new Error('Expected a review_scope object.');
    if(data.review_scope&&typeof data.review_scope==='object'&&!Array.isArray(data.review_scope)){for(const [name,value] of Object.entries(data.review_scope)) scopeState[name]=value===true; localStorage.setItem(scopeKey,JSON.stringify(scopeState));}
    for(const [name,item] of Object.entries(data.screenshots)){
      if(!item||typeof item!=='object') continue;
      const status=['pending','pass','issue','skip'].includes(item.status)?item.status:'pending';
      state[name]={...item,status,note:typeof item.note==='string'?item.note:''};
    }
    save();
  }catch(error){
    alert('Could not import review JSON: '+error.message);
  }finally{
    event.target.value='';
  }
});
document.querySelector('#clear').addEventListener('click',()=>{if(confirm('Clear local review statuses?')){localStorage.removeItem(key);localStorage.removeItem(scopeKey);location.reload();}});
document.querySelectorAll('[data-skip-duplicate-aliases]').forEach(button=>button.addEventListener('click',()=>{
  if(!reviewerName()){alert('Enter reviewer name before marking duplicate aliases skipped.');reviewerInput.focus();return;}
  const reviewedAt=new Date().toISOString();
  let changed=0;
  for(const action of duplicateAliasActions){
    if(!metadata[action.file]) continue;
    state[action.file]=currentReview(action.file,{status:'skip',note:action.note,reviewed_at:reviewedAt,reviewed_by:reviewerName()});
    changed++;
  }
  save();
  alert('Marked '+changed+' documented duplicate alias screenshot'+(changed===1?'':'s')+' as skipped.');
}));
document.querySelector('#next-pending').addEventListener('click',()=>{
  const pending=shots.filter(shot=>!shot.classList.contains('hidden')&&shot.dataset.status==='pending');
  if(pending.length===0) return;
  pendingCursor=(pendingCursor+1)%pending.length;
  pending[pendingCursor].scrollIntoView({behavior:'smooth',block:'start'});
  pending[pendingCursor].focus({preventScroll:true});
});
reviewerInput.addEventListener('input',()=>localStorage.setItem(reviewerKey,reviewerName()));
zoomInput.addEventListener('change',()=>{localStorage.setItem(zoomKey,zoomInput.value);render();});
document.querySelector('#filter').addEventListener('input',render);
document.querySelector('#status').addEventListener('change',render);
document.querySelector('#viewport').addEventListener('change',render);
document.querySelector('#section').addEventListener('change',render);
render();
</script>`;
  let html = `<!doctype html><meta charset="utf-8"><title>Affordance Atlas Visual Snapshot Review</title><style>${css}</style><h1>Affordance Atlas Visual Snapshot Review</h1><p class="meta">${report.actual} PNG snapshots from ${report.states} named states. Expected ${report.expected}. Audit pass: ${report.pass}. Inventory items: ${report.coverage.inventoryItems}; coverage missing: ${report.coverage.missingCoverage.length}; unexpected duplicates: ${report.unexpectedDuplicates.length}.</p><div class="toolbar"><input id="filter" type="search" placeholder="Filter screenshots"><select id="status"><option value="all">All statuses</option><option value="pending">Pending</option><option value="pass">Pass</option><option value="issue">Issue</option><option value="skip">Skipped</option></select><select id="viewport" aria-label="Viewport"><option value="all">All viewports</option><option value="mobile">Mobile</option><option value="tablet">Tablet</option><option value="desktop">Desktop</option><option value="wide">Wide</option><option value="narrow">Narrow</option><option value="boundary">Boundary</option></select><select id="section" aria-label="Inventory section"><option value="all">All sections</option>${sectionOptions}</select><select id="zoom" aria-label="Screenshot size"><option value="small">Small screenshots</option><option value="medium">Medium screenshots</option><option value="large">Large screenshots</option><option value="full">Full-width screenshots</option></select><label class="reviewer-label" for="reviewer">Reviewer<input id="reviewer" type="text" placeholder="Reviewer name"></label><button id="next-pending" type="button">Next pending</button><button id="export" type="button">Export review JSON</button><label class="import-label" for="import">Import review JSON<input id="import" type="file" accept="application/json"></label><button id="clear" type="button">Clear local review</button><span id="counts" class="count"></span></div><section class="scope"><strong>Required review scope</strong><div>${scopeChecks}</div></section><section class="section-progress"><strong>Inventory section progress</strong><table id="section-progress"><thead><tr><th>Section</th><th>Total</th><th>Pass</th><th>Issue</th><th>Skip</th><th>Pending</th></tr></thead><tbody></tbody></table></section>`;

  if (report.duplicateReview.length > 0) {
    html += `<section class="dupes"><strong>Duplicate image groups for review</strong><p><button type="button" data-skip-duplicate-aliases>Mark documented aliases skipped</button></p><ol>${report.duplicateReview.map((item) => `<li><code>${item.files.join("</code><br><code>")}</code><p>${item.rationale ?? "Unexpected duplicate; investigate this state."}</p></li>`).join("")}</ol></section>`;
  }

  html += `<main class="grid">${report.entries.map((entry) => { const coverage = entry.coverageItems.length > 0 ? `<details class="coverage"><summary>Covers ${entry.coverageItems.length} inventory item${entry.coverageItems.length === 1 ? "" : "s"}</summary><ul>${entry.coverageItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></details>` : `<div class="coverage">No mapped inventory items.</div>`; return `<article id="${escapeHtml(shotAnchor(entry.file))}" class="shot" tabindex="-1" data-file="${entry.file}" data-state="${entry.state}" data-viewport="${entry.viewport}" data-sections="${escapeHtml(entry.coverageSections.join("||"))}" data-coverage="${escapeHtml(entry.coverageItems.join(" | "))}"><img src="visual/${entry.file}" loading="lazy"><div class="name">${entry.file}</div><div class="dims">${entry.width} x ${entry.height} / ${entry.bytes} bytes</div><div class="shot-actions"><a href="#${escapeHtml(shotAnchor(entry.file))}">Link</a><a href="visual/${entry.file}" target="_blank" rel="noopener">Open full size</a></div>${coverage}<div class="review"><select aria-label="Review status for ${entry.file}"><option value="pending">Pending review</option><option value="pass">Pass</option><option value="issue">Issue found</option><option value="skip">Skipped/alias</option></select><textarea aria-label="Review note for ${entry.file}" placeholder="Review note"></textarea></div></article>`; }).join("")}</main>${reviewScript}`;
  return html;
}

function writeContactSheet(report) {
  fs.writeFileSync(indexPath, buildContactSheetHtml(report));
}

fs.mkdirSync(outputDir, { recursive: true });
const report = buildReport();
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
writeContactSheet(report);
writeInventoryCoverage(report);
writeDuplicateReviewArtifact(report);
writeChatProgressionArtifact(report);
writeChatProgressionHtml(report);
writeSectionSheets(report);
writeReviewStatusTemplate(report);
writeReviewTodo(report);
writeReviewSectionQueue(report);
writeReviewTodoJson(report);

console.log(JSON.stringify({
  expected: report.expected,
  actual: report.actual,
  states: report.states,
  pass: report.pass,
  missingStates: report.missingStates.length,
  extraStates: report.extraStates.length,
  missingFiles: report.missingFiles.length,
  extraFiles: report.extraFiles.length,
  dimensionIssues: report.dimensionIssues.length,
  visualQualityIssues: report.visualQualityIssues.length,
  duplicates: report.duplicates.length,
  unexpectedDuplicates: report.unexpectedDuplicates.length,
  inventoryItems: report.coverage.inventoryItems,
  coverageMissing: report.coverage.missingCoverage.length,
  coverageUnknownStates: report.coverage.unknownStateReferences.length,
  entriesWithoutCoverage: report.entriesWithoutCoverage.length,
  entriesWithoutCoverageSections: report.entriesWithoutCoverageSections.length,
  inventorySections: report.inventorySections.length,
  inventoryCoverageItems: report.inventoryItemCoverage.items,
  inventoryCoverageCompleteItems: report.inventoryItemCoverage.completeItems,
  inventoryCoverageIncompleteItems: report.inventoryItemCoverage.incompleteItems.length,
  inventoryCoverageFileReferences: report.inventoryItemCoverage.totalFileReferences,
  chatProgressionRequiredStages: report.chatProgression.requiredStages,
  chatProgressionCompleteStages: report.chatProgression.completeStages,
  chatProgressionMissingStages: report.chatProgression.missingStages.length,
  chatProgressionExpectedFiles: report.chatProgression.expectedFiles,
  chatProgressionMissingFiles: report.chatProgression.missingFiles.length,
  manualReviewRequired: report.manualReview.required,
  manualReviewComplete: report.manualReview.complete,
  manualReviewPending: report.manualReview.counts.pending,
  manualReviewIssues: report.manualReview.counts.issue,
  manualReviewSections: report.manualReview.sections.length,
  manualReviewSectionsWithPending: report.manualReview.sectionsWithPending.length,
  manualReviewSectionsWithIssues: report.manualReview.sectionsWithIssues.length,
  manualReviewChangedFiles: report.manualReview.changedFiles.length,
  manualReviewStaleFiles: report.manualReview.staleFiles.length,
  manualReviewSkippedWithoutNotes: report.manualReview.skippedWithoutNotes.length,
  manualReviewIssuesWithoutNotes: report.manualReview.issuesWithoutNotes.length,
  manualReviewMissingTimestamps: report.manualReview.missingReviewTimestamps.length,
  manualReviewTemporalIssues: report.manualReview.temporalIssues.length,
  manualReviewMissingReviewers: report.manualReview.missingReviewers.length,
  manualReviewInvalidStatuses: report.manualReview.invalidStatuses.length,
  manualReviewStatusFileSchemaIssue: report.manualReview.statusFileSchemaIssue ? 1 : 0,
  manualReviewStatusFileGeneratedAtIssue: report.manualReview.statusFileGeneratedAtIssue ? 1 : 0,
  manualReviewStatusFileScreenshotsIssue: report.manualReview.statusFileScreenshotsIssue ? 1 : 0,
  manualReviewStatusFileScreenshotCountIssue: report.manualReview.statusFileScreenshotCountIssue ? 1 : 0,
  manualReviewStatusFileSnapshotSetIssue: report.manualReview.statusFileSnapshotSetIssue ? 1 : 0,
  manualReviewStatusFileReviewScopeIssue: report.manualReview.statusFileReviewScopeIssue ? 1 : 0,
  manualReviewReviewScopeTimestampIssue: report.manualReview.reviewScopeTimestampIssue ? 1 : 0,
  manualReviewReviewScopeReviewerIssue: report.manualReview.reviewScopeReviewerIssue ? 1 : 0,
  manualReviewMissingReviewScopeItems: report.manualReview.missingReviewScopeItems.length,
  reviewTodoUniquePendingOrIssue: report.reviewTodo.uniquePendingOrIssue,
  reviewTodoSectionPendingOrIssueReferences: report.reviewTodo.sectionPendingOrIssueReferences,
  reviewTodoJsonUniquePendingOrIssue: report.reviewTodo.jsonUniquePendingOrIssue,
  reviewTodoJsonSectionPendingOrIssueReferences: report.reviewTodo.jsonSectionPendingOrIssueReferences,
  reviewTodoConsistencyIssues: report.reviewTodo.consistencyIssues.length,
  reviewTodoLinkItemReferences: report.reviewTodo.linkItemReferences,
  reviewTodoContactSheetLinks: report.reviewTodo.contactSheetLinks,
  reviewTodoScreenshotLinks: report.reviewTodo.screenshotLinks,
  reviewSectionQueueSections: report.reviewSectionQueue.sections,
  reviewSectionQueueSectionsWithRemaining: report.reviewSectionQueue.sectionsWithRemaining,
  reviewSectionQueueRemainingReferences: report.reviewSectionQueue.remainingReferences,
  reviewSectionQueueConsistencyIssues: report.reviewSectionQueue.consistencyIssues.length,
  reviewStatusTemplateScreenshots: report.reviewStatusTemplate.screenshots,
  reviewStatusTemplatePendingScreenshots: report.reviewStatusTemplate.pendingScreenshots,
  reviewStatusTemplateScopeItems: report.reviewStatusTemplate.scopeItems,
  reviewStatusTemplateConsistencyIssues: report.reviewStatusTemplate.consistencyIssues.length,
  duplicateReviewGroups: report.duplicateReviewArtifact.groups,
  duplicateReviewClassifiedGroups: report.duplicateReviewArtifact.classifiedGroups,
  duplicateReviewUnexpectedGroups: report.duplicateReviewArtifact.unexpectedGroups,
  duplicateReviewAliasFiles: report.duplicateReviewArtifact.aliasFiles,
  duplicateReviewConsistencyIssues: report.duplicateReviewArtifact.consistencyIssues.length,
  duplicateAliasActionFiles: report.duplicateAliasActions.actionFiles,
  duplicateAliasActionConsistencyIssues: report.duplicateAliasActions.consistencyIssues.length,
  contactSheetToolbarControls: report.contactSheetControls.toolbarControls,
  contactSheetFilterControls: report.contactSheetControls.filterControls,
  contactSheetStatusOptions: report.contactSheetControls.statusOptions,
  contactSheetViewportFilterOptions: report.contactSheetControls.viewportFilterOptions,
  contactSheetSectionFilterOptions: report.contactSheetControls.sectionFilterOptions,
  contactSheetZoomOptions: report.contactSheetControls.zoomOptions,
  contactSheetScopeControlReferences: report.contactSheetControls.scopeControlReferences,
  contactSheetReviewStatusControls: report.contactSheetControls.reviewStatusControls,
  contactSheetReviewNoteControls: report.contactSheetControls.reviewNoteControls,
  contactSheetExportSchemaReferences: report.contactSheetControls.exportSchemaReferences,
  contactSheetExportSnapshotSetReferences: report.contactSheetControls.exportSnapshotSetReferences,
  contactSheetExportScreenshotCountReferences: report.contactSheetControls.exportScreenshotCountReferences,
  contactSheetImportControlReferences: report.contactSheetControls.importControlReferences,
  contactSheetImportGuardReferences: report.contactSheetControls.importGuardReferences,
  contactSheetWarningSummaryReferences: report.contactSheetControls.warningSummaryReferences,
  contactSheetNextPendingReferences: report.contactSheetControls.nextPendingReferences,
  contactSheetDuplicateAliasActionFiles: report.contactSheetControls.duplicateAliasActionFiles,
  contactSheetConsistencyIssues: report.contactSheetControls.consistencyIssues.length,
  chatProgressionArtifactStages: report.chatProgressionArtifact.stages,
  chatProgressionArtifactCompleteStages: report.chatProgressionArtifact.completeStages,
  chatProgressionArtifactExpectedFiles: report.chatProgressionArtifact.expectedFiles,
  chatProgressionArtifactMissingStages: report.chatProgressionArtifact.missingStages,
  chatProgressionArtifactMissingFiles: report.chatProgressionArtifact.missingFiles,
  chatProgressionArtifactConsistencyIssues: report.chatProgressionArtifact.consistencyIssues.length,
  chatProgressionHtmlStageAnchors: report.chatProgressionHtml.stageAnchors,
  chatProgressionHtmlImageReferences: report.chatProgressionHtml.imageReferences,
  chatProgressionHtmlConsistencyIssues: report.chatProgressionHtml.consistencyIssues.length,
  sectionSheetsSections: report.sectionSheets.sections,
  sectionSheetsImageReferences: report.sectionSheets.imageReferences,
  sectionSheetsPendingReferences: report.sectionSheets.pendingReferences,
  sectionSheetsIssueReferences: report.sectionSheets.issueReferences,
  sectionSheetsIndexLinks: report.sectionSheets.indexLinks,
  sectionSheetsScopeControlReferences: report.sectionSheets.scopeControlReferences,
  sectionSheetsExportSchemaReferences: report.sectionSheets.exportSchemaReferences,
  sectionSheetsExportSnapshotSetReferences: report.sectionSheets.exportSnapshotSetReferences,
  sectionSheetsExportScreenshotCountReferences: report.sectionSheets.exportScreenshotCountReferences,
  sectionSheetsImportControlReferences: report.sectionSheets.importControlReferences,
  sectionSheetsImportGuardReferences: report.sectionSheets.importGuardReferences,
  sectionSheetsWarningSummaryReferences: report.sectionSheets.warningSummaryReferences,
  sectionSheetsNextPendingReferences: report.sectionSheets.nextPendingReferences,
  sectionSheetsFilterControlReferences: report.sectionSheets.filterControlReferences,
  sectionSheetsConsistencyIssues: report.sectionSheets.consistencyIssues.length,
  tinyFiles: report.tinyFiles.length,
}, null, 2));

if (!report.pass) {
  process.exitCode = 1;
}
