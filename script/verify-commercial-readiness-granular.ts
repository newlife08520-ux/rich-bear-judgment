/**
 * Commercial readiness 細項別名（由 verify:commercial-readiness 鏈末尾執行）。
 * 用法：tsx script/verify-commercial-readiness-granular.ts [task|all]
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf-8");
}

function must(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("[FAIL]", msg);
    process.exit(1);
  }
}

function mustExist(rel: string, tag: string): void {
  must(fs.existsSync(path.join(root, rel)), `${tag}: missing ${rel}`);
}

function mustInclude(rel: string, needle: string, tag: string): void {
  must(read(rel).includes(needle), `${tag}: ${rel} must include ${needle.slice(0, 60)}`);
}

const tasks: Record<string, () => void> = {
  "publish-mvp": () => {
    mustExist("docs/active/PUBLISH-MVP-CLOSURE.md", "publish-mvp");
    mustExist("docs/active/PUBLISH-USER-FLOW.md", "publish-mvp");
    mustExist("docs/active/PUBLISH-LIMITATIONS-AND-SAFETY.md", "publish-mvp");
    mustInclude("server/modules/execution/execution-handler-registry.ts", "metaPublishDraftExecuteHandler", "publish-mvp");
    mustInclude("client/src/pages/publish/PublishPageView.tsx", "送往 Meta", "publish-mvp");
  },
  "publish-ui-no-placeholder": () => {
    must(!fs.existsSync(path.join(root, "client/src/pages/publish-placeholder.tsx")), "remove publish-placeholder.tsx");
    mustInclude("client/src/App.tsx", "publish-center-page", "publish-ui");
    mustInclude("client/src/App.tsx", "PublishCenterPage", "publish-ui");
  },
  "publish-apply-persistence": () => {
    mustInclude("server/modules/publish/publish-routes.ts", "/drafts", "publish-apply");
    mustInclude("server/modules/publish/publish-service.ts", "createDraft", "publish-apply");
  },
  "publish-meta-write-foundation": () => {
    mustInclude("client/src/pages/publish/usePublishWorkbench.ts", "mapMetaOrNetworkErrorToActionability", "meta-write");
    mustInclude("client/src/pages/publish/widgets/PublishExecutionGateDialog.tsx", "gateMode", "meta-write");
  },
  "out-of-band-sync": () => {
    mustExist("docs/active/OUT-OF-BAND-SYNC-DESIGN.md", "oob");
    mustInclude("server/modules/sync/out-of-band-hints.ts", "computeOutOfBandHints", "oob");
  },
  "adjust-ledger-reconciliation": () => {
    mustInclude(
      "server/modules/creative-intelligence/workbench-adjust-prisma.ts",
      "resetAdjustCountsForUserToday",
      "adjust-ledger",
    );
    mustInclude("server/modules/sync/sync-routes.ts", "resetAdjustCountsForUserToday", "adjust-ledger-sync");
  },
  "external-change-warning-surface": () => {
    mustInclude("client/src/components/sync/ExternalMetaDriftBanner.tsx", "external-meta-drift-banner", "ext-warn");
    mustInclude("client/src/pages/judgment.tsx", "ExternalMetaDriftBanner", "ext-warn");
  },
  "execution-history": () => {
    mustExist("docs/active/EXECUTION-AUDIT-SURFACE.md", "exec-hist");
    mustInclude("client/src/pages/execution-history.tsx", "execution-history-page", "exec-hist");
    mustInclude("client/src/pages/execution-history.tsx", "execution-history-filters", "exec-hist");
    mustExist("client/src/lib/execution-log-display.ts", "exec-hist");
  },
  "audit-accountability": () => {
    mustExist("docs/active/EXECUTION-ACCOUNTABILITY-RULES.md", "acct-rules");
  },
  "cross-surface-execution-links": () => {
    mustInclude("client/src/App.tsx", "/execution-history", "links");
    mustInclude("client/src/pages/dashboard.tsx", "link-dashboard-to-execution-audit", "links");
    mustInclude("client/src/pages/products/ProductsPageView.tsx", "link-products-to-execution-audit", "links");
    mustInclude("client/src/pages/publish/PublishPageView.tsx", "link-publish-to-execution-audit", "links");
    mustInclude("client/src/pages/fb-ads/FbAdsPageView.tsx", "link-fbads-to-execution-audit", "links");
  },
  "commercial-readiness-gemini-doc-surface": () => {
    const rels = [
      "docs/active/GEMINI-RECONCILIATION-BATCH16.2.md",
      "docs/active/PUBLISH-MVP-CLOSURE-v2.md",
      "docs/active/PUBLISH-REALITY-CHECK.md",
      "docs/active/OUT-OF-BAND-SYNC-DESIGN-v2.md",
      "docs/active/EXTERNAL-META-CHANGE-POLICY-v2.md",
      "docs/active/EXECUTION-AUDIT-SURFACE-v2.md",
      "docs/active/META-ERROR-HANDLING-RUNBOOK-v2.md",
      "docs/active/ACTIONABLE-ERROR-UX-MATRIX-v2.md",
      "docs/active/DATA-TRUTH-STATE-MACHINE-v2.md",
      "docs/active/PARTIAL-VS-NO-DATA-PLAYBOOK-v2.md",
      "docs/active/TRUTH-PACK-TIER-MODEL-v3.md",
      "docs/active/STAGING-CAPTURE-CONTRACT-v2.md",
      "docs/active/PROD-SANITIZATION-CONTRACT-v2.md",
      "docs/active/TIER-D-DIRTY-ACCOUNT-PACK-v2.md",
      "docs/active/TIER-D-COVERAGE-MATRIX-v2.md",
      "docs/active/ROUTES-SPLIT-PROGRESS-B.md",
      "docs/active/SCHEMA-SPLIT-PROGRESS-B.md",
      "docs/active/STRATEGIC-UI-POLISH-v1.md",
      "docs/active/HOMEPAGE-HIERARCHY-vNext.md",
      "docs/active/JUDGMENT-FOCUS-MINIMALITY-vNext.md",
    ];
    for (const r of rels) {
      mustExist(r, "gemini-docs");
    }
  },
  "meta-error-ux": () => {
    mustExist("docs/active/META-ERROR-HANDLING-RUNBOOK.md", "meta-ux");
    mustExist("docs/active/ACTIONABLE-ERROR-UX-MATRIX.md", "meta-ux");
    mustInclude("client/src/lib/meta-error-actionability.ts", "mapMetaOrNetworkErrorToActionability", "meta-ux");
    mustInclude("client/src/App.tsx", "MetaApiErrorProvider", "meta-banner");
    mustInclude("client/src/App.tsx", "MetaGlobalErrorBanner", "meta-banner");
  },
  "token-expiry-surface": () => {
    mustInclude("client/src/lib/meta-error-actionability.ts", "reauth", "token");
  },
  "rate-limit-degradation": () => {
    mustInclude("client/src/lib/meta-error-actionability.ts", "429", "rate");
  },
  "data-truth": () => {
    mustExist("docs/active/DATA-TRUTH-STATE-MACHINE.md", "truth");
    mustInclude("shared/data-truth-state-machine.ts", "partial_data", "truth");
  },
  "partial-no-data-separation": () => {
    mustExist("docs/active/PARTIAL-VS-NO-DATA-PLAYBOOK.md", "partial-playbook");
    mustInclude("shared/data-truth-state-machine.ts", "partial_decision", "partial");
  },
  "cross-surface-truth-consistency": () => {
    mustInclude("shared/homepage-data-truth.ts", "homepageTruthFieldsForDataConfidence", "truth-cross");
  },
  "tier-d-pack": () => {
    mustExist("docs/active/TIER-D-DIRTY-ACCOUNT-PACK.md", "tier-d");
    mustExist("docs/active/TIER-D-COVERAGE-MATRIX.md", "tier-d");
    mustExist("docs/SANITIZED-DB-SNAPSHOTS/tier-d-dirty-longtail-zero-spend.json", "tier-d");
  },
  "pareto-dirty-account-resilience": () => {
    mustInclude("shared/visibility-policy.ts", "lowConfidenceDormant", "pareto-dirty");
  },
  "pacing-dirty-account-resilience": () => {
    mustInclude("server/modules/goal-pacing/build-product-pacing.ts", "learningPhaseProtected", "pacing-dirty");
  },
  "learning-phase-guard": () => {
    mustInclude("shared/goal-pacing-engine.ts", "learningPhaseProtected", "learn-guard");
  },
  "learning-phase-ui": () => {
    const ci = read("client/src/pages/creative-intelligence.tsx");
    const gp = read("shared/goal-pacing-engine.ts");
    must(
      ci.includes("learningPhaseProtected") || ci.includes("learning-phase") || gp.includes("learningPhaseProtected"),
      "learning-phase-ui",
    );
  },
  "no-premature-kill": () => {
    mustInclude("shared/goal-pacing-engine.ts", "learningPhaseProtected", "no-kill");
  },
  "dormant-score-clamp": () => {
    mustInclude("shared/visibility-policy.ts", "DORMANT_NOISE", "dormant-clamp");
  },
  "dormant-low-confidence": () => {
    mustInclude("shared/visibility-policy.ts", "lowConfidenceDormant", "dormant-lc");
  },
  "ci-statistical-disclosure": () => {
    mustExist("docs/active/CI-STATISTICAL-LIMITATIONS.md", "ci-doc");
    mustInclude("client/src/pages/creative-intelligence.tsx", "ci-statistical-disclosure", "ci");
  },
  "ci-low-confidence-demotion": () => {
    mustInclude("client/src/pages/creative-intelligence.tsx", "ci-low-confidence-demotion-hint", "ci-demote");
  },
  "routes-split-meta-ops": () => {
    must(fs.existsSync(path.join(root, "server/routes/fb-ads-api-routes.ts")), "fb-ads module");
    must(read("server/routes.ts").includes("registerFbAdsApiRoutes"), "routes composes fb-ads");
  },
  "schema-split-publish": () => {
    must(read("shared/schema.ts").includes("./schema/publish-draft-contract"), "schema re-export publish-draft");
  },
  "verify-chain-map": () => {
    mustExist("docs/active/VERIFY-CHAIN-CANONICAL-MAP-v2.md", "v2");
    mustExist("docs/active/VERIFY-CHAIN-MIGRATION-NOTES-v2.md", "v2-migration");
  },
  "legacy-alias-compatibility": () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    must(pkg.scripts["verify:wave:commercial"]?.includes("verify:commercial-readiness"), "wave:commercial alias");
  },
  "canonical-release-entrypoints": () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    must(pkg.scripts["verify:release-candidate"]?.includes("verify:product-restructure"), "release-candidate");
    must(pkg.scripts["verify:product-restructure"]?.includes("verify:commercial-readiness"), "product-restructure");
  },
};

const order = Object.keys(tasks).sort();
const arg = process.argv[2] ?? "all";

if (arg === "all") {
  for (const k of order) {
    console.log(`[granular] ${k}…`);
    tasks[k]();
    console.log(`[PASS] ${k}`);
  }
  console.log("[PASS] verify-commercial-readiness-granular (all)");
} else if (tasks[arg]) {
  console.log(`[granular] ${arg}…`);
  tasks[arg]();
  console.log(`[PASS] ${arg}`);
} else {
  console.error("Unknown task:", arg, "use: all |", order.join(" | "));
  process.exit(1);
}
