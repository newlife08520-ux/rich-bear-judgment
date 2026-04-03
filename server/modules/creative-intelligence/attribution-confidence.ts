/**
 * 6.9：版本／商品 drilldown 用的歸因信心與歧義說明（純敘述，不改分數語意）。
 */
import type { CreativeExperimentLink, CreativeOutcomeSnapshot } from "@prisma/client";

/** 7.3：由 links + 快照計算歧義訊號（供 /version 與 UI） */
export function computeVersionAmbiguitySignals(
  links: Pick<
    CreativeExperimentLink,
    "isActive" | "isPrimary" | "campaignId" | "linkLifecycleState"
  >[],
  latestSnap: Pick<CreativeOutcomeSnapshot, "ambiguousAttribution"> | null
): {
  snapshotAmbiguous: boolean;
  multiActiveSameCampaign: boolean;
  staleCampaignOverlap: boolean;
  primaryCount: number;
  /** 7.8：停用／superseded 連結仍指向與現行 active 相同的 campaign */
  supersededCompetingWithActive: boolean;
} {
  const act = links.filter((l) => l.isActive && l.linkLifecycleState === "active");
  const primaryCount = act.filter((l) => l.isPrimary).length;
  const byCamp = new Map<string, number>();
  for (const l of act) {
    if (!l.campaignId) continue;
    byCamp.set(l.campaignId, (byCamp.get(l.campaignId) ?? 0) + 1);
  }
  const multiActiveSameCampaign = [...byCamp.values()].some((c) => c > 1);
  const activeCamp = new Set(act.map((l) => l.campaignId).filter(Boolean) as string[]);
  const staleCampaignOverlap = links.some(
    (l) =>
      l.linkLifecycleState !== "active" &&
      Boolean(l.campaignId) &&
      activeCamp.has(l.campaignId as string)
  );
  const supersededCompetingWithActive = links.some(
    (l) =>
      (l.linkLifecycleState === "soft_inactive" || l.linkLifecycleState === "superseded") &&
      Boolean(l.campaignId) &&
      activeCamp.has(l.campaignId as string)
  );
  return {
    snapshotAmbiguous: Boolean(latestSnap?.ambiguousAttribution),
    multiActiveSameCampaign,
    staleCampaignOverlap,
    primaryCount,
    supersededCompetingWithActive,
  };
}

export type AttributionConfidenceLevel = "high" | "medium" | "low" | "ambiguous";

export function confidenceFromSnapshot(
  snap: Pick<CreativeOutcomeSnapshot, "ambiguousAttribution" | "confidenceLevel"> | null
): {
  level: AttributionConfidenceLevel;
  summary: string;
  ambiguityExplanation?: string;
} {
  if (!snap) {
    return {
      level: "low",
      summary: "尚無 outcome 快照；無法對版本做花費歸因評估。",
    };
  }
  if (snap.ambiguousAttribution) {
    return {
      level: "ambiguous",
      summary: "此快照標記為多版本／非 primary 競爭同一 campaign 歸因。",
      ambiguityExplanation:
        "同一 campaign 對應多個 active link，或唯一 link 並非 isPrimary，系統不將此筆列入高信心贏家／落後模式。",
    };
  }
  const cl = (snap.confidenceLevel ?? "").toLowerCase();
  if (cl === "high") {
    return { level: "high", summary: "單一 primary active link 對應 campaign，歸因路徑一致。" };
  }
  if (cl === "medium") {
    return { level: "medium", summary: "結構上可歸因至 primary，仍建議對照審判與素材上下文。" };
  }
  return { level: "low", summary: "歸因結構允許，但樣本或訊號偏弱，僅供參考。" };
}

export function linkAttributionSummary(
  links: Pick<CreativeExperimentLink, "isActive" | "isPrimary" | "campaignId" | "removedAt">[]
): { lines: string[] } {
  const active = links.filter((l) => l.isActive);
  const withCamp = active.filter((l) => l.campaignId);
  const primary = active.filter((l) => l.isPrimary);
  const lines: string[] = [];
  lines.push(
    `Active links：${active.length}；含 Meta campaignId：${withCamp.length}；標為 primary：${primary.length}。`
  );
  if (primary.length > 1) lines.push("警告：多個 primary 並存，與預期不符，請檢查草稿同步。");
  if (withCamp.length > 0 && primary.length === 0) {
    lines.push("有 campaign 但無 primary：歸因視為低信心／歧義。");
  }
  return { lines };
}

/** 7.3：歧義原因（供 UI badge）；7.8：superseded 與 active 同 campaign */
export function ambiguityReasonLines(params: {
  snapshotAmbiguous: boolean;
  multiActiveSameCampaign: boolean;
  staleCampaignOverlap: boolean;
  primaryCount: number;
  supersededCompetingWithActive?: boolean;
}): string[] {
  const lines: string[] = [];
  if (params.snapshotAmbiguous) lines.push("快照標記為歧義歸因（ambiguousAttribution）；模式彙總與 winner 敘事已降權。");
  if (params.multiActiveSameCampaign) lines.push("同一 Meta campaign 綁定多個 lifecycle=active 的 link。");
  if (params.staleCampaignOverlap) lines.push("存在非 active／superseded 但仍帶舊 campaignId 的連結，與現行歸因窗口重疊風險。");
  if (params.supersededCompetingWithActive) {
    lines.push("存在 soft_inactive／superseded 連結仍指向與現行 active 相同的 campaign；請勿將關聯快照當唯一真相。");
  }
  if (params.primaryCount !== 1) lines.push(`primary 連結數為 ${params.primaryCount}（預期 1）。`);
  if (lines.length === 0) return ["目前無額外歧義訊號（仍請對照樣本量）。"];
  return lines;
}

export function whyWinningWhyLosing(
  snap: Pick<CreativeOutcomeSnapshot, "lifecycleLabel" | "roas" | "spend" | "ambiguousAttribution"> | null
): { whyWinning?: string; whyLosing?: string } {
  if (!snap || snap.ambiguousAttribution) return {};
  const label = snap.lifecycleLabel ?? "";
  const roas = snap.roas;
  const spend = snap.spend;
  if (label === "WINNER" || label === "UNDERFUNDED_GOOD" || label === "HIDDEN_DIAMOND") {
    return {
      whyWinning: `生命週期標籤「${label}」：ROAS≈${roas.toFixed(2)}、花費≈${spend.toFixed(0)}（僅供營運解讀，非保證）。`,
    };
  }
  if (label === "LOSING" || label === "RETIRED") {
    return {
      whyLosing: `生命週期標籤「${label}」：ROAS≈${roas.toFixed(2)}、花費≈${spend.toFixed(0)}；建議對照素材診斷與預算節奏。`,
    };
  }
  return {};
}
