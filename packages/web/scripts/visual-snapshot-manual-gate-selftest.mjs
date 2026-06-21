import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "e2e-snapshots");
const reportPath = path.join(outputDir, "visual-review-report.json");
const statusPath = path.join(outputDir, "visual-review-status.json");
const backupPath = path.join(outputDir, "visual-review-status.selftest-backup.json");

function runAudit(args = []) {
  return spawnSync(process.execPath, ["scripts/visual-snapshot-audit.mjs", ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function parseAuditSummary(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error(`Could not find JSON audit summary in output:\n${stdout}`);
  }
  return JSON.parse(stdout.slice(start, end + 1));
}

function writeStatusFile(packet) {
  fs.writeFileSync(statusPath, JSON.stringify(packet, null, 2));
}

function strictSummary() {
  const result = runAudit(["--require-manual-review"]);
  return { result, summary: parseAuditSummary(result.stdout) };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function restoreOriginal(hadOriginal) {
  if (fs.existsSync(statusPath)) fs.rmSync(statusPath);
  if (hadOriginal) fs.renameSync(backupPath, statusPath);
}

function expectStrictPass(packet) {
  writeStatusFile(packet);
  const { result, summary } = strictSummary();
  if (result.status !== 0 || !summary.pass || !summary.manualReviewComplete || summary.manualReviewPending !== 0 || summary.manualReviewSections !== 14 || summary.manualReviewSectionsWithPending !== 0 || summary.manualReviewSectionsWithIssues !== 0) {
    throw new Error(`Strict manual gate did not pass with a complete synthetic review file.\n${result.stdout}\n${result.stderr}`);
  }
  return summary;
}

function expectStrictFail(name, packet, predicate) {
  writeStatusFile(packet);
  const { result, summary } = strictSummary();
  if (result.status === 0 || summary.pass || !predicate(summary)) {
    throw new Error(`Strict manual gate did not fail as expected for ${name}.\n${result.stdout}\n${result.stderr}`);
  }
  return name;
}

fs.mkdirSync(outputDir, { recursive: true });
const hadOriginal = fs.existsSync(statusPath);
if (fs.existsSync(backupPath)) fs.rmSync(backupPath);
if (hadOriginal) fs.renameSync(statusPath, backupPath);

try {
  const baseline = runAudit();
  if (baseline.status !== 0) {
    throw new Error(`Baseline visual audit failed before self-test.\n${baseline.stdout}\n${baseline.stderr}`);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const generatedAt = new Date().toISOString();
  const reviewer = "visual-gate-selftest";
  const reviewScope = Object.fromEntries(report.manualReview.requiredReviewScope.map((item) => [item, true]));
  const screenshots = Object.fromEntries(report.entries.map((entry) => [entry.file, {
    state: entry.state,
    viewport: entry.viewport,
    width: entry.width,
    height: entry.height,
    sha256: entry.sha256,
    status: "pass",
    note: "",
    reviewed_at: generatedAt,
    reviewed_by: reviewer,
  }]));

  const completePacket = {
    schema: "affordance-atlas.visual-review-status.v1",
    generated_at: generatedAt,
    screenshot_count: report.actual,
    snapshot_set_sha256: report.manualReview.expectedSnapshotSetSha256,
    review_scope: reviewScope,
    review_scope_reviewed_at: generatedAt,
    review_scope_reviewed_by: reviewer,
    screenshots,
  };

  const passSummary = expectStrictPass(completePacket);
  const firstFile = report.entries[0].file;
  const failedCases = [];

  const staleHash = clone(completePacket);
  staleHash.screenshots[firstFile].sha256 = "0".repeat(64);
  failedCases.push(expectStrictFail("stale screenshot hash", staleHash, (summary) => summary.manualReviewChangedFiles === 1 && summary.manualReviewSectionsWithPending >= 1));

  const issueWithoutNote = clone(completePacket);
  issueWithoutNote.screenshots[firstFile].status = "issue";
  issueWithoutNote.screenshots[firstFile].note = "";
  failedCases.push(expectStrictFail("issue without note", issueWithoutNote, (summary) => summary.manualReviewIssues === 1 && summary.manualReviewIssuesWithoutNotes === 1 && summary.manualReviewSectionsWithIssues >= 1));

  const missingScope = clone(completePacket);
  delete missingScope.review_scope[report.manualReview.requiredReviewScope[0]];
  failedCases.push(expectStrictFail("missing review scope item", missingScope, (summary) => summary.manualReviewMissingReviewScopeItems === 1));

  const missingScopeReviewer = clone(completePacket);
  missingScopeReviewer.review_scope_reviewed_by = "";
  failedCases.push(expectStrictFail("missing review scope reviewer", missingScopeReviewer, (summary) => summary.manualReviewReviewScopeReviewerIssue === 1));

  const staleSnapshotSet = clone(completePacket);
  staleSnapshotSet.snapshot_set_sha256 = "f".repeat(64);
  failedCases.push(expectStrictFail("stale snapshot set hash", staleSnapshotSet, (summary) => summary.manualReviewStatusFileSnapshotSetIssue === 1));

  const invalidStatus = clone(completePacket);
  invalidStatus.screenshots[firstFile].status = "approved";
  failedCases.push(expectStrictFail("invalid screenshot status", invalidStatus, (summary) => summary.manualReviewInvalidStatuses === 1));

  const missingScreenshotReviewer = clone(completePacket);
  missingScreenshotReviewer.screenshots[firstFile].reviewed_by = "";
  failedCases.push(expectStrictFail("missing screenshot reviewer", missingScreenshotReviewer, (summary) => summary.manualReviewMissingReviewers === 1));

  const futureScreenshotTimestamp = clone(completePacket);
  futureScreenshotTimestamp.screenshots[firstFile].reviewed_at = "2999-01-01T00:00:00.000Z";
  failedCases.push(expectStrictFail("future screenshot timestamp", futureScreenshotTimestamp, (summary) => summary.manualReviewTemporalIssues === 1));

  const malformedScreenshots = clone(completePacket);
  malformedScreenshots.screenshots = [];
  failedCases.push(expectStrictFail("malformed screenshots object", malformedScreenshots, (summary) => summary.manualReviewStatusFileScreenshotsIssue === 1));

  const staleScreenshotCount = clone(completePacket);
  staleScreenshotCount.screenshot_count = report.actual - 1;
  failedCases.push(expectStrictFail("stale screenshot count", staleScreenshotCount, (summary) => summary.manualReviewStatusFileScreenshotCountIssue === 1));

  const missingSchema = clone(completePacket);
  delete missingSchema.schema;
  failedCases.push(expectStrictFail("missing schema", missingSchema, (summary) => summary.manualReviewStatusFileSchemaIssue === 1));

  const futureGeneratedAt = clone(completePacket);
  futureGeneratedAt.generated_at = "2999-01-01T00:00:00.000Z";
  failedCases.push(expectStrictFail("future generated_at", futureGeneratedAt, (summary) => summary.manualReviewStatusFileGeneratedAtIssue === 1));

  const skipWithoutNote = clone(completePacket);
  skipWithoutNote.screenshots[firstFile].status = "skip";
  skipWithoutNote.screenshots[firstFile].note = "";
  failedCases.push(expectStrictFail("skip without note", skipWithoutNote, (summary) => summary.manualReviewSkippedWithoutNotes === 1));

  const missingScreenshotTimestamp = clone(completePacket);
  missingScreenshotTimestamp.screenshots[firstFile].reviewed_at = "";
  failedCases.push(expectStrictFail("missing screenshot timestamp", missingScreenshotTimestamp, (summary) => summary.manualReviewMissingTimestamps === 1));

  const staleExtraFile = clone(completePacket);
  staleExtraFile.screenshots["not-a-current-screenshot.png"] = clone(staleExtraFile.screenshots[firstFile]);
  failedCases.push(expectStrictFail("stale extra file", staleExtraFile, (summary) => summary.manualReviewStaleFiles === 1 && !summary.manualReviewComplete));

  const missingScopeTimestamp = clone(completePacket);
  missingScopeTimestamp.review_scope_reviewed_at = "";
  failedCases.push(expectStrictFail("missing review scope timestamp", missingScopeTimestamp, (summary) => summary.manualReviewReviewScopeTimestampIssue === 1));

  console.log(JSON.stringify({
    pass: true,
    verifiedScreenshots: report.entries.length,
    requiredReviewScope: report.manualReview.requiredReviewScope.length,
    manualReviewComplete: passSummary.manualReviewComplete,
    manualReviewPending: passSummary.manualReviewPending,
    manualReviewSections: passSummary.manualReviewSections,
    manualReviewSectionsWithPending: passSummary.manualReviewSectionsWithPending,
    manualReviewSectionsWithIssues: passSummary.manualReviewSectionsWithIssues,
    negativeCases: failedCases,
  }, null, 2));
} finally {
  restoreOriginal(hadOriginal);
  const finalAudit = runAudit();
  if (finalAudit.status !== 0) {
    process.stderr.write(finalAudit.stdout);
    process.stderr.write(finalAudit.stderr);
    process.exitCode = finalAudit.status ?? 1;
  }
}
