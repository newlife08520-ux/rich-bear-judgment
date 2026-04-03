/**
 * 7.6：單一營運用 Pareto command payload（包在 engine v2 之上，不取代其數學）。
 * 8.1：v4 — 四層對齊摘要 + operational 參照（與舊啟發式差異顯性化）。
 */
import type { ParetoEngineV2Payload, ParetoScopeLevel } from "@shared/pareto-engine";

export interface ParetoCommandLayerPayload {
  version: "v4";
  generatedAt: string;
  engineV2: ParetoEngineV2Payload;
  /** 8.1：company / account / product / creative_version 精簡營運摘要 */
  crossLevelDigest: Record<
    ParetoScopeLevel,
    {
      label: string;
      itemCount: number;
      topContributorLabel?: string;
      dragLabel?: string;
      hiddenDiamondN: number;
      moneyPitN: number;
    }
  >;
  /** 少做：高花費低效／money pit 敘事 */
  doLess: {
    expensiveMistakesToReduce: string[];
    shrinkOrPauseHints: string[];
  };
  /** 多做：hidden diamond／top winner 敘事 */
  doMore: {
    expandCandidates: string[];
    dominantWinningHooks: string[];
  };
  /** 舊啟發式 vs 引擎差異提示（營運診斷） */
  legacyVsEngine: {
    note: string;
    whenLegacyViewDiffers: string;
    /** 8.1：UI 應顯示「底層 bucket 可能與 scoring-engine 標籤不一致」之提示 */
    surfaceDiffInstruction: string;
  };
}

function scopeDigest(level: ParetoScopeLevel, engineV2: ParetoEngineV2Payload) {
  const block = engineV2.scopes.find((s) => s.level === level);
  const wb = block?.workbench;
  const items = block?.items ?? [];
  const top = wb?.topRevenueContributors?.[0]?.label;
  const drag = wb?.topLossDrivers?.[0]?.label;
  return {
    label: block?.label ?? level,
    itemCount: items.length,
    topContributorLabel: top,
    dragLabel: drag,
    hiddenDiamondN: wb?.hiddenDiamonds?.length ?? 0,
    moneyPitN: wb?.moneyPits?.length ?? 0,
  };
}

export function buildParetoCommandLayer(engineV2: ParetoEngineV2Payload): ParetoCommandLayerPayload {
  const productScope = engineV2.scopes.find((s) => s.level === "product");
  const wb = productScope?.workbench;
  const money = wb?.moneyPits?.map((m) => m.label).slice(0, 8) ?? [];
  const diamonds = wb?.hiddenDiamonds?.map((m) => m.label).slice(0, 8) ?? [];
  const topWin = wb?.topRevenueContributors?.map((m) => m.label).slice(0, 6) ?? [];
  const hooks = wb?.dominantWinningHooks ?? [];

  const levels: ParetoScopeLevel[] = ["company", "account", "product", "creative_version"];
  const crossLevelDigest = {} as ParetoCommandLayerPayload["crossLevelDigest"];
  for (const lv of levels) {
    crossLevelDigest[lv] = scopeDigest(lv, engineV2);
  }

  return {
    version: "v4",
    generatedAt: new Date().toISOString(),
    engineV2,
    crossLevelDigest,
    doLess: {
      expensiveMistakesToReduce: money.length ? money : ["（樣本不足）尚無明確 money pit 清單"],
      shrinkOrPauseHints: (wb?.topLossDrivers ?? []).map((x) => x.label).slice(0, 6),
    },
    doMore: {
      expandCandidates: [...new Set([...diamonds, ...topWin])].slice(0, 10),
      dominantWinningHooks: hooks.slice(0, 12),
    },
    legacyVsEngine: {
      note: "舊版 dashboard 啟發式仍以 server/scoring-engine 為歷史相容；Pareto v2／command v4 以 profit-like 與樣本信心為主敘事。",
      whenLegacyViewDiffers:
        "當 ROAS 閾值標籤與 Pareto bucket 不一致時，以本 command layer 的 engineV2.canonicalWorkbench 為準，並對照素材歧義歸因標記。",
      surfaceDiffInstruction:
        "四張皮（Dashboard／商品／FB／Creative Intelligence）應同讀本 API；若畫面上舊卡片文案與 doLess／doMore 不一致，視為已知 surface diff，請以本 payload 為準。",
    },
  };
}
