import type { ConnectionStatus } from "./settings-types";

export const TOKEN_WARNING_THRESHOLD = 8000;
export const CURRENT_AI_MODEL = "gemini-3.1-pro-preview";

export const STATUS_LAMP_COLORS: Record<ConnectionStatus, string> = {
  idle: "bg-slate-300",
  testing: "bg-amber-400 animate-pulse",
  success: "bg-emerald-500",
  error: "bg-rose-500",
};

export const STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: "尚未驗證",
  testing: "驗證中",
  success: "驗證成功",
  error: "驗證失敗",
};
