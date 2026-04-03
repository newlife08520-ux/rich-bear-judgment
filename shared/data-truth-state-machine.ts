/**
 * 全站資料真值狀態機（不含 persona／校準語意）。
 */
export type DataTruthState = "has_data" | "partial_data" | "no_data" | "no_sync";

export function normalizeDashboardDataStatus(
  raw: string | undefined | null
): DataTruthState | null {
  if (!raw) return null;
  if (raw === "has_data" || raw === "partial_data" || raw === "no_data" || raw === "no_sync") {
    return raw;
  }
  if (raw === "partial_decision") return "partial_data";
  return null;
}

export function dataTruthStateLabelZh(state: DataTruthState): string {
  switch (state) {
    case "has_data":
      return "資料就緒";
    case "partial_data":
      return "部分資料／摘要可能晚到";
    case "no_data":
      return "此範圍尚無可用分析資料";
    case "no_sync":
      return "尚未完成帳戶同步";
    default:
      return "未知";
  }
}

export function dataTruthUserGuidanceZh(state: DataTruthState): string {
  switch (state) {
    case "has_data":
      return "可依決策卡與指揮序操作；執行動作仍須經 execution gate。";
    case "partial_data":
      return "主決策區塊可能仍可用；建議完成更新資料後再下高風險結論。";
    case "no_data":
      return "請先確認帳戶、日期範圍與同步狀態。";
    case "no_sync":
      return "請先連結 Meta／GA4 並完成至少一次資料更新。";
    default:
      return "";
  }
}
