/**
 * Commercial readiness：103–112 契約守門（可傳參數只跑單一 id，或 all）。
 * 用法：tsx script/verify-commercial-readiness.ts [103|103_1|...|all]
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (process.argv[2] ?? "all").toLowerCase();

function must(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("[FAIL]", msg);
    process.exit(1);
  }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf-8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

type Check = { id: string; run: () => void };

const checks: Check[] = [
  {
    id: "103",
    run: () => {
      must(exists("docs/active/PUBLISH-MVP-CLOSURE.md"), "missing PUBLISH-MVP-CLOSURE.md");
      must(exists("docs/active/PUBLISH-USER-FLOW.md"), "missing PUBLISH-USER-FLOW.md");
      const reg = read("server/modules/execution/execution-handler-registry.ts");
      must(reg.includes("meta_publish_draft_execute"), "registry missing meta_publish");
      const pv = read("client/src/pages/publish/PublishPageView.tsx");
      must(pv.includes("送往 Meta"), "PublishPageView missing 送往 Meta");
    },
  },
  {
    id: "103_1",
    run: () => {
      const pv = read("client/src/pages/publish/PublishPageView.tsx");
      must(pv.includes("建立投放草稿"), "publish UI dead-end check");
      must(pv.includes("PublishWizardDialog"), "wizard wired");
    },
  },
  {
    id: "103_2",
    run: () => {
      must(exists("prisma/migrations/20260402180000_meta_campaign_budget_snapshot/migration.sql"), "snapshot migration");
      const rj = read("server/refresh-job-runner.ts");
      must(rj.includes("persistMetaCampaignSnapshotsFromBatch"), "refresh persists snapshots");
    },
  },
  {
    id: "103_3",
    run: () => {
      const wb = read("client/src/pages/publish/usePublishWorkbench.ts");
      must(wb.includes("mapMetaOrNetworkErrorToActionability"), "publish error surface");
    },
  },
  {
    id: "104",
    run: () => {
      must(exists("docs/active/OUT-OF-BAND-SYNC-DESIGN.md"), "OUT-OF-BAND-SYNC-DESIGN");
      must(exists("docs/active/EXTERNAL-META-CHANGE-POLICY.md"), "EXTERNAL-META-CHANGE-POLICY");
      const hints = read("server/modules/sync/out-of-band-hints.ts");
      must(hints.includes("computeOutOfBandHints"), "out-of-band hints");
      must(read("server/modules/sync/sync-routes.ts").includes("/out-of-band-hints"), "sync routes");
    },
  },
  {
    id: "104_1",
    run: () => {
      const b = read("client/src/components/sync/ExternalMetaDriftBanner.tsx");
      must(b.includes("校準今日調整節奏"), "stale pacing ack copy");
    },
  },
  {
    id: "104_2",
    run: () => {
      const b = read("client/src/components/sync/ExternalMetaDriftBanner.tsx");
      must(b.includes("external-meta-drift-banner"), "data-testid drift banner");
    },
  },
  {
    id: "105",
    run: () => {
      must(exists("docs/active/EXECUTION-AUDIT-SURFACE.md"), "EXECUTION-AUDIT-SURFACE");
      must(read("client/src/App.tsx").includes("/execution-history"), "App route execution-history");
      must(read("client/src/pages/execution-history.tsx").includes("execution-history-page"), "audit page testid");
    },
  },
  {
    id: "105_1",
    run: () => {
      const p = read("client/src/pages/execution-history.tsx");
      must(p.includes("dryRunId") && p.includes("rollbackNote"), "audit fields");
    },
  },
  {
    id: "105_2",
    run: () => {
      must(read("client/src/pages/dashboard.tsx").includes("link-dashboard-to-execution-audit"), "dashboard audit link");
    },
  },
  {
    id: "106",
    run: () => {
      must(exists("docs/active/META-ERROR-HANDLING-RUNBOOK.md"), "META-ERROR-HANDLING-RUNBOOK");
      must(read("client/src/lib/meta-error-actionability.ts").includes("mapMetaOrNetworkErrorToActionability"), "mapper");
    },
  },
  {
    id: "106_1",
    run: () => {
      const m = read("client/src/lib/meta-error-actionability.ts");
      must(m.includes("reauth") && m.includes("重新連結"), "token actionability");
    },
  },
  {
    id: "106_2",
    run: () => {
      const m = read("client/src/lib/meta-error-actionability.ts");
      must(m.includes("429") || m.includes("retry_later"), "rate limit degradation");
    },
  },
  {
    id: "107",
    run: () => {
      must(exists("docs/active/DATA-TRUTH-STATE-MACHINE.md"), "DATA-TRUTH-STATE-MACHINE");
      must(read("shared/data-truth-state-machine.ts").includes("DataTruthState"), "state machine module");
    },
  },
  {
    id: "107_1",
    run: () => {
      must(read("shared/data-truth-state-machine.ts").includes("partial_data"), "partial_data in machine");
    },
  },
  {
    id: "107_2",
    run: () => {
      must(read("shared/data-truth-state-machine.ts").includes("partial_decision"), "partial_decision map");
    },
  },
  {
    id: "108",
    run: () => {
      must(exists("docs/active/TIER-D-DIRTY-ACCOUNT-PACK.md"), "TIER-D pack doc");
      must(exists("docs/SANITIZED-DB-SNAPSHOTS/tier-d-dirty-1.json"), "tier-d snapshot 1");
      must(exists("docs/SANITIZED-DB-SNAPSHOTS/tier-d-dirty-2.json"), "tier-d snapshot 2");
      must(exists("docs/SANITIZED-DB-SNAPSHOTS/tier-d-dirty-3.json"), "tier-d snapshot 3");
    },
  },
  {
    id: "108_1",
    run: () => {
      must(read("shared/visibility-policy.ts").includes("DORMANT_NOISE_CONVERSION_MIN"), "pareto/dormant noise constants");
    },
  },
  {
    id: "108_2",
    run: () => {
      must(read("shared/goal-pacing-engine.ts").includes("learningPhaseProtected"), "pacing dirty resilience hook");
    },
  },
  {
    id: "109",
    run: () => {
      must(read("shared/goal-pacing-engine.ts").includes("learningPhaseProtected"), "learning guard engine");
      must(read("server/modules/goal-pacing/build-product-pacing.ts").includes("learningPhaseProtected"), "learning in build");
    },
  },
  {
    id: "109_1",
    run: () => {
      must(read("shared/goal-pacing-engine.ts").includes("learning-phase-protected"), "learning UI copy");
    },
  },
  {
    id: "109_2",
    run: () => {
      must(read("shared/goal-pacing-engine.ts").includes("HOLD_STABLE"), "hold stance exists");
    },
  },
  {
    id: "110",
    run: () => {
      must(read("shared/visibility-policy.ts").includes("lowConfidenceDormant"), "dormant noise clamp");
    },
  },
  {
    id: "110_1",
    run: () => {
      must(read("shared/visibility-policy.ts").includes("0.35"), "dormant score demotion factor");
    },
  },
  {
    id: "111",
    run: () => {
      must(read("client/src/pages/creative-intelligence.tsx").includes("ci-statistical-disclosure"), "CI disclosure");
    },
  },
  {
    id: "111_1",
    run: () => {
      const ci = read("client/src/pages/creative-intelligence.tsx");
      must(ci.includes("歸因") || ci.includes("樣本"), "CI low-confidence / attribution copy");
    },
  },
  {
    id: "112",
    run: () => {
      must(exists("docs/active/VERIFY-CHAIN-CANONICAL-MAP-v2.md"), "VERIFY-CHAIN v2");
      const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
      must(
        pkg.scripts["verify:commercial-readiness"]?.includes("verify-commercial-readiness"),
        "verify:commercial-readiness script"
      );
      must(pkg.scripts["verify:product-restructure"]?.includes("verify:commercial-readiness"), "product-restructure includes commercial");
    },
  },
];

function main() {
  const runIds =
    arg === "all"
      ? checks.map((c) => c.id)
      : checks.some((c) => c.id === arg)
        ? [arg]
        : (console.error("[FAIL] unknown check id", arg), process.exit(1), []);

  for (const id of runIds) {
    const c = checks.find((x) => x.id === id)!;
    c.run();
    console.log("[PASS] commercial check", id);
  }
  if (arg === "all") console.log("[PASS] verify-commercial-readiness all", runIds.length, "checks");
}

main();
