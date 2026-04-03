import type { SettingsInput, UserSettings } from "@shared/schema";
import type { ConnectionResult, ConnectionStatus } from "./settings-types";

/** 送出前補齊 enum 預設值，避免 undefined 導致後端 schema 或舊資料造成 400 */
export function normalizeSettingsPayload(data: Partial<SettingsInput>): SettingsInput {
  return {
    ga4PropertyId: data.ga4PropertyId ?? "",
    fbAccessToken: data.fbAccessToken ?? "",
    aiApiKey: data.aiApiKey ?? "",
    systemPrompt: data.systemPrompt ?? "",
    coreMasterPrompt: data.coreMasterPrompt ?? "",
    modeAPrompt: data.modeAPrompt ?? "",
    modeBPrompt: data.modeBPrompt ?? "",
    modeCPrompt: data.modeCPrompt ?? "",
    modeDPrompt: data.modeDPrompt ?? "",
    severity:
      data.severity && ["strict", "moderate", "lenient"].includes(data.severity)
        ? data.severity
        : "moderate",
    outputLength:
      data.outputLength && ["summary", "standard", "detailed"].includes(data.outputLength)
        ? data.outputLength
        : "standard",
    brandTone:
      data.brandTone && ["professional", "direct", "friendly", "aggressive"].includes(data.brandTone)
        ? data.brandTone
        : "professional",
    analysisBias:
      data.analysisBias && ["commercial", "creative", "conversion", "brand"].includes(data.analysisBias)
        ? data.analysisBias
        : "conversion",
  };
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
  const nonCjk = text.length - cjkCount;
  return Math.round(cjkCount * 1.5 + nonCjk / 4);
}

export function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "剛剛";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function buildInitialResultFromSettings(
  type: "fb" | "ga4" | "ai",
  settings: UserSettings | undefined
): ConnectionResult {
  if (!settings) return { status: "idle", message: "", checkedAt: null };
  const statusKey = `${type}Status` as keyof UserSettings;
  const atKey = `${type}VerifiedAt` as keyof UserSettings;
  const errKey = `${type}LastError` as keyof UserSettings;
  const status = (settings[statusKey] as ConnectionStatus) || "idle";
  const checkedAt = (settings[atKey] as string | null) ?? null;
  const message =
    (settings[errKey] as string | null) ?? (status === "success" ? "上次驗證成功" : "");
  return { status, message: message || "", checkedAt };
}
