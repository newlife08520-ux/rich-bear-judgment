/**
 * Commercial readiness：Batch 15.3–16.1 + verify 鏈 v2（單一入口，失敗時 exit 1）。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf-8");
}

function mustExist(rel: string, tag: string): void {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`[FAIL] ${tag}: missing`, rel);
    process.exit(1);
  }
}

function mustInclude(rel: string, sub: string, tag: string): void {
  const t = read(rel);
  if (!t.includes(sub)) {
    console.error(`[FAIL] ${tag}: ${rel} must include`, sub.slice(0, 80));
    process.exit(1);
  }
}

console.log("[verify-commercial-readiness] Batch 103 Publish MVP…");
mustExist("docs/active/PUBLISH-MVP-CLOSURE.md", "103");
mustExist("docs/active/PUBLISH-USER-FLOW.md", "103");
mustInclude("server/modules/execution/execution-handler-registry.ts", "metaPublishDraftExecuteHandler", "103");
mustInclude("client/src/pages/publish/PublishPageView.tsx", "送往 Meta", "103");
mustInclude("client/src/pages/publish/widgets/PublishExecutionGateDialog.tsx", "gateMode", "103");
mustInclude("server/refresh-job-runner.ts", "persistMetaCampaignSnapshotsFromBatch", "103_2");
mustInclude("prisma/schema.prisma", "MetaCampaignBudgetSnapshot", "103_2");
mustInclude("client/src/pages/publish/usePublishWorkbench.ts", "mapMetaOrNetworkErrorToActionability", "103_3");

console.log("[verify-commercial-readiness] Batch 104 Out-of-band…");
mustExist("docs/active/OUT-OF-BAND-SYNC-DESIGN.md", "104");
mustExist("docs/active/EXTERNAL-META-CHANGE-POLICY.md", "104");
mustInclude("server/modules/sync/out-of-band-hints.ts", "computeOutOfBandHints", "104");
mustInclude("server/modules/sync/sync-routes.ts", "/out-of-band-hints", "104");
mustInclude("client/src/components/sync/ExternalMetaDriftBanner.tsx", "external-meta-drift-banner", "104_2");
mustInclude("client/src/pages/judgment.tsx", "ExternalMetaDriftBanner", "104_1");

console.log("[verify-commercial-readiness] Batch 105 Execution audit…");
mustExist("docs/active/EXECUTION-AUDIT-SURFACE.md", "105");
mustInclude("client/src/pages/execution-history.tsx", "execution-history-page", "105");
mustInclude("client/src/App.tsx", "/execution-history", "105");
mustInclude("client/src/pages/dashboard.tsx", "link-dashboard-to-execution-audit", "105_2");

console.log("[verify-commercial-readiness] Batch 106 Meta errors…");
mustExist("docs/active/META-ERROR-HANDLING-RUNBOOK.md", "106");
mustInclude("client/src/lib/meta-error-actionability.ts", "mapMetaOrNetworkErrorToActionability", "106");
mustInclude("client/src/lib/meta-error-actionability.ts", "reauth", "106_1");
mustInclude("client/src/lib/meta-error-actionability.ts", "429", "106_2");

console.log("[verify-commercial-readiness] Batch 107 Data truth…");
mustExist("docs/active/DATA-TRUTH-STATE-MACHINE.md", "107");
mustInclude("shared/data-truth-state-machine.ts", "partial_data", "107");
mustInclude("shared/data-truth-state-machine.ts", "partial_decision", "107_2");

console.log("[verify-commercial-readiness] Batch 108 Tier D…");
mustExist("docs/active/TIER-D-DIRTY-ACCOUNT-PACK.md", "108");
mustExist("docs/SANITIZED-DB-SNAPSHOTS/tier-d-dirty-longtail-zero-spend.json", "108");
mustExist("docs/SANITIZED-DB-SNAPSHOTS/tier-d-dirty-pacing-sparse.json", "108");
mustExist("docs/SANITIZED-DB-SNAPSHOTS/tier-d-dirty-dormant-noisy.json", "108");
mustInclude("shared/visibility-policy.ts", "lowConfidenceDormant", "110_1");

console.log("[verify-commercial-readiness] Batch 109 Learning guard…");
mustInclude("shared/goal-pacing-engine.ts", "learningPhaseProtected", "109");
mustInclude("server/modules/goal-pacing/build-product-pacing.ts", "learningPhaseProtected", "109");

console.log("[verify-commercial-readiness] Batch 111 CI disclosure…");
mustInclude("client/src/pages/creative-intelligence.tsx", "ci-statistical-disclosure", "111");
mustInclude("client/src/pages/creative-intelligence.tsx", "ci-low-confidence-demotion-hint", "111_1");

console.log("[verify-commercial-readiness] Batch 112 Verify chain v2…");
mustExist("docs/active/VERIFY-CHAIN-CANONICAL-MAP-v2.md", "112");
const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
if (!pkg.scripts["verify:commercial-readiness"]?.includes("verify-commercial-readiness-chain")) {
  console.error("[FAIL] 112: package.json missing verify:commercial-readiness chain");
  process.exit(1);
}
if (!pkg.scripts["verify:product-restructure"]?.includes("verify:commercial-readiness")) {
  console.error("[FAIL] 112: verify:product-restructure must chain verify:commercial-readiness");
  process.exit(1);
}

const gen = read("script/lib/review-pack-generator-version.mjs");
if (!gen.includes("batch16_2")) {
  console.error("[FAIL] generator should be batch16_2 for commercial wave (16.2 Gemini integration)");
  process.exit(1);
}

console.log("[PASS] verify-commercial-readiness-chain (103–112)");
