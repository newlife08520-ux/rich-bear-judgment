/**
 * 由 docs/RUNTIME-QUERY-CAPTURES（supertest 真 route）衍生 LIVE-RUNTIME-CAPTURES。
 * Batch 10.0：trustTier v3 + derivedFrom + route + 預留 staging 路徑說明見 TRUTH-PACK-TRUST-LADDER.md
 *
 * npm run capture:live-runtime-captures
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const runtimeDir = path.join(root, "docs", "RUNTIME-QUERY-CAPTURES");
const liveDir = path.join(root, "docs", "LIVE-RUNTIME-CAPTURES");

const MAPPINGS: [string, string][] = [
  ["dashboard-cross-account-summary.has-data.json", "dashboard-cross-account-summary.has-data.live.json"],
  ["dashboard-cross-account-summary.partial-data.json", "dashboard-cross-account-summary.partial-data.live.json"],
  ["dashboard-cross-account-summary.no-data.json", "dashboard-cross-account-summary.no-data.live.json"],
  ["dashboard-action-center.core.json", "dashboard-action-center.core.live.json"],
  ["dashboard-action-center.diagnostics.json", "dashboard-action-center.diagnostics.live.json"],
  ["zero-spend-core-vs-diagnostics.sample.json", "zero-spend-core-vs-diagnostics.live.json"],
  ["dashboard-data-confidence.with-products.json", "dashboard-data-confidence.live.json"],
  ["workbench-goal-pacing.sample.json", "workbench-goal-pacing.live.json"],
  ["workbench-decision-cards.sample.json", "workbench-decision-cards.live.json"],
  ["pareto-command-layer.sample.json", "pareto-command-layer.live.json"],
  ["creative-intelligence-patterns.sample.json", "creative-intelligence-patterns.live.json"],
  ["creative-intelligence-version.sample.json", "creative-intelligence-version.live.json"],
  ["creative-intelligence-product.sample.json", "creative-intelligence-product.live.json"],
];

const ROUTE_BY_SRC: Record<string, string> = {
  "dashboard-cross-account-summary.has-data.json": "GET /api/dashboard/cross-account-summary",
  "dashboard-cross-account-summary.partial-data.json": "GET /api/dashboard/cross-account-summary",
  "dashboard-cross-account-summary.no-data.json": "GET /api/dashboard/cross-account-summary",
  "dashboard-action-center.core.json": "GET /api/dashboard/action-center",
  "dashboard-action-center.diagnostics.json": "GET /api/dashboard/action-center (diagnostics slice)",
  "zero-spend-core-vs-diagnostics.sample.json": "GET /api/dashboard/action-center (derived split)",
  "dashboard-data-confidence.with-products.json": "GET /api/dashboard/data-confidence",
  "workbench-goal-pacing.sample.json": "GET /api/workbench/goal-pacing",
  "workbench-decision-cards.sample.json": "GET /api/workbench/decision-cards",
  "pareto-command-layer.sample.json": "GET /api/pareto/command-layer",
  "creative-intelligence-patterns.sample.json": "GET /api/creative-intelligence/patterns",
  "creative-intelligence-version.sample.json": "GET /api/creative-intelligence/version/:id",
  "creative-intelligence-product.sample.json": "GET /api/creative-intelligence/product/:name",
};

function unwrapPayload(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "body" in (raw as object)) {
    return (raw as { body: unknown }).body;
  }
  return raw;
}

function main() {
  fs.mkdirSync(liveDir, { recursive: true });
  const now = new Date().toISOString();
  for (const [srcName, dstName] of MAPPINGS) {
    const srcPath = path.join(runtimeDir, srcName);
    if (!fs.existsSync(srcPath)) {
      console.error("[capture-live] missing runtime file:", srcPath);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(srcPath, "utf-8")) as unknown;
    const payload = unwrapPayload(raw);
    const derivedFrom = `docs/RUNTIME-QUERY-CAPTURES/${srcName}`;
    const route = ROUTE_BY_SRC[srcName] ?? "GET (see RUNTIME-QUERY-CAPTURES)";
    const out = {
      captureMeta: {
        source: "seeded-runtime-http" as const,
        trustTier: "seeded-runtime-explicit-provenance-v3" as const,
        provenanceSchemaVersion: "v3" as const,
        stagingRuntimeCapture: false,
        environment: "local-supertest",
        generatedAt: now,
        sanitized: true,
        captureMethod: "derive-from-RUNTIME-QUERY-CAPTURES",
        derivedFrom,
        route,
        note: `Derived from ${derivedFrom}; payload = HTTP JSON body after supertest sanitize.`,
        notes: `Derived from ${derivedFrom}; payload = HTTP JSON body after supertest sanitize.`,
      },
      payload,
    };
    const dstPath = path.join(liveDir, dstName);
    fs.writeFileSync(dstPath, JSON.stringify(out, null, 2) + "\n", "utf-8");
    console.log("[capture-live] wrote", dstPath);
  }

  const stagingDir = path.join(root, "docs", "STAGING-RUNTIME-CAPTURES");
  fs.mkdirSync(stagingDir, { recursive: true });
  const stagingPlaceholder = path.join(stagingDir, "_staging-runtime-separated.placeholder.json");
  fs.writeFileSync(
    stagingPlaceholder,
    JSON.stringify(
      {
        captureMeta: {
          source: "staging-placeholder" as const,
          trustTier: "staging-sanitized" as const,
          separatedFromSeeded: true,
          stagingRuntimeCapture: false,
          environment: "not-captured-in-repo",
          generatedAt: now,
          note: "Batch 10.8: staging tier lives only under docs/STAGING-RUNTIME-CAPTURES. Replace with real sanitized staging HTTP capture when available; never commit staging JSON into LIVE-RUNTIME-CAPTURES.",
        },
        payload: null,
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  console.log("[capture-live] wrote", stagingPlaceholder);

  const separationNote = path.join(liveDir, "SEEDED-VS-STAGING.md");
  fs.writeFileSync(
    separationNote,
    [
      "# Seeded runtime vs staging (Batch 10.8)",
      "",
      "- **Seeded canonical**: `docs/LIVE-RUNTIME-CAPTURES/*.live.json` with `trustTier: seeded-runtime-explicit-provenance-v3` — derived from `docs/RUNTIME-QUERY-CAPTURES` (supertest).",
      "- **Staging tier**: `docs/STAGING-RUNTIME-CAPTURES/_staging-runtime-separated.placeholder.json` — `trustTier: staging-sanitized`, `payload: null` until a real capture is checked in. **Do not** place staging files under LIVE.",
      "- Do **not** call seeded files \"production live\" in reviewer copy; use tier labels from `captureMeta.trustTier`.",
      "",
      "## Truth pack layering (v6)",
      "",
      "- **LIVE-RUNTIME-CAPTURES**: seeded supertest-derived tier (`seeded-runtime-explicit-provenance-v3`); canonical for review ZIP truth ladder.",
      "- **STAGING-RUNTIME-CAPTURES**: separate sanitized tier placeholder; never mixed into LIVE paths.",
      "",
    ].join("\n"),
    "utf-8"
  );
  console.log("[capture-live] wrote", separationNote);

  console.log("[capture-live-runtime-captures] done");
}

main();
