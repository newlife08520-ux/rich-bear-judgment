/**
 * Meta／Graph 常見錯誤 → 使用者可行动文案（不含 persona）。
 */
export type MetaErrorActionKind = "reauth" | "retry_later" | "readonly" | "check_permissions" | "unknown";

export type MetaErrorActionability = {
  title: string;
  description: string;
  primaryAction: MetaErrorActionKind;
  /** 次要建議（例如保留草稿） */
  secondaryNote?: string;
};

function lower(s: string): string {
  return s.toLowerCase();
}

/** 從 HTTP 狀態、JSON message、或 Error.message 粗分類 */
export function mapMetaOrNetworkErrorToActionability(input: {
  status?: number;
  message?: string;
}): MetaErrorActionability {
  const msg = lower(input.message ?? "");
  const st = input.status;

  if (st === 401 || msg.includes("oauth") || msg.includes("token") || msg.includes("權杖")) {
    return {
      title: "授權已失效或不足",
      description: "請至設定重新連結 Meta 或更新存取權杖後再試。",
      primaryAction: "reauth",
      secondaryNote: "草稿與稽核紀錄仍保留於系統。",
    };
  }
  if (st === 403 || msg.includes("permission") || msg.includes("權限") || msg.includes("#200")) {
    return {
      title: "權限不足",
      description: "此操作需要更高權限的 Meta 應用程式或廣告帳戶角色；請確認後台授權範圍。",
      primaryAction: "check_permissions",
    };
  }
  if (st === 429 || msg.includes("rate limit") || msg.includes("too many")) {
    return {
      title: "請求過於頻繁",
      description: "Meta 暫時限制呼叫頻率；請稍後再試，並避免短時間內重複大量操作。",
      primaryAction: "retry_later",
    };
  }
  if (
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed") ||
    msg.includes("超時")
  ) {
    return {
      title: "網路或服務暫時不穩",
      description: "可稍後重試；若僅檢視資料，可先使用已同步之批次結果（唯讀）。",
      primaryAction: "retry_later",
      secondaryNote: "未完成的 apply 不會自動重送。",
    };
  }

  return {
    title: "操作未完成",
    description: input.message?.trim() || "請確認訊息後再試，或聯繫管理員檢視稽核紀錄。",
    primaryAction: "unknown",
  };
}
