import type { DecisionCardBlock } from "@shared/decision-cards-engine";
import type { TodayActionRow } from "@/pages/dashboard/dashboard-types";

export type MappedExecution = {
  actionType: string;
  payload: Record<string, unknown>;
  label: string;
};

/** 需先以目前每日預算換算後再送 dry-run */
export type BudgetPctExecution = {
  kind: "budget_pct";
  campaignId: string;
  /** 正為加碼、負為降預算 */
  pct: number;
  label: string;
};

export type TodayActionExecutionPlan = MappedExecution | BudgetPctExecution | null;

function extractLongNumericId(text: string | undefined): string | null {
  if (!text?.trim()) return null;
  const m = text.match(/\b(\d{12,})\b/);
  return m ? m[1]! : null;
}

/** 從 /api/fb-ads/campaigns-scored 取 Graph 每日預算（與批次內 dailyBudgetMinor 一致） */
export async function fetchCampaignDailyBudgetMinor(campaignId: string): Promise<number | null> {
  const res = await fetch("/api/fb-ads/campaigns-scored", { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { campaigns?: Array<{ campaignId: string; dailyBudgetMinor?: number | null }> };
  const row = data.campaigns?.find((c) => c.campaignId === campaignId);
  if (row?.dailyBudgetMinor != null && Number.isFinite(row.dailyBudgetMinor) && row.dailyBudgetMinor > 0) {
    return Math.round(row.dailyBudgetMinor);
  }
  return null;
}

export function mapTodayActionToExecution(row: TodayActionRow): TodayActionExecutionPlan {
  const campaignId = row.campaignId?.trim();
  if (!campaignId || row.objectType !== "活動") return null;

  if (row.suggestedPct === "關閉") {
    return {
      actionType: "meta_campaign_pause",
      payload: { campaignId },
      label: "暫停活動（建議關閉）",
    };
  }

  if (typeof row.suggestedPct === "number" && Number.isFinite(row.suggestedPct) && row.suggestedPct !== 0) {
    const a = row.suggestedAction;
    if (a === "可加碼" || a === "高潛延伸" || a === "先降" || a === "小降觀察") {
      const pct = a === "先降" || a === "小降觀察" ? -Math.abs(row.suggestedPct) : Math.abs(row.suggestedPct);
      return {
        kind: "budget_pct",
        campaignId,
        pct,
        label: `${a} ${row.suggestedPct > 0 ? "+" : ""}${row.suggestedPct}% 預算`,
      };
    }
  }

  return null;
}

/**
 * Decision 卡僅有文字與可選 copyableText；能解析出 campaignId 且語意明確時才可一鍵執行。
 */
export function mapSuggestedActionToExecution(card: DecisionCardBlock): TodayActionExecutionPlan {
  const haystack = [card.suggestedAction, card.conclusion, card.copyableText].filter(Boolean).join("\n");
  const campaignId = extractLongNumericId(card.copyableText) ?? extractLongNumericId(haystack);
  if (!campaignId) return null;

  if (/關閉|暫停|停損|先暫停|PAUSED/i.test(haystack) && !/不要暫停|勿停|誤殺/i.test(haystack)) {
    return {
      actionType: "meta_campaign_pause",
      payload: { campaignId },
      label: "暫停活動",
    };
  }

  const pctMatch = haystack.match(/([+-]?\d+)\s*%/);
  if (pctMatch) {
    const n = Number(pctMatch[1]);
    if (Number.isFinite(n) && n !== 0 && /加碼|提高|上調|擴量|降|減碼|下調/i.test(haystack)) {
      const neg = /降|減碼|下調|先降|止血/i.test(haystack) && !/加碼|提高|上調|擴量/i.test(haystack);
      const pct = neg ? -Math.abs(n) : Math.abs(n);
      return {
        kind: "budget_pct",
        campaignId,
        pct,
        label: `調整預算約 ${pct}%`,
      };
    }
  }

  return null;
}

export async function resolveBudgetPctToMappedExecution(plan: BudgetPctExecution): Promise<MappedExecution | null> {
  const base = await fetchCampaignDailyBudgetMinor(plan.campaignId);
  if (base == null) return null;
  const factor = 1 + plan.pct / 100;
  const next = Math.max(1, Math.round(base * factor));
  return {
    actionType: "meta_campaign_update_budget",
    payload: { campaignId: plan.campaignId, budgetDaily: next },
    label: plan.label,
  };
}
