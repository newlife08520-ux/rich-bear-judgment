/**
 * 正式環境 SESSION_SECRET：預設 fail-fast（≥32）；Railway 等 PaaS 未設變數時可自動暫用密鑰以免整站 502。
 * 見 docs/active/RAILWAY-DEPLOY.md
 */
import { randomBytes } from "crypto";

function isRailwayRuntime(): boolean {
  return Boolean(
    (process.env.RAILWAY_ENVIRONMENT || "").trim() ||
      (process.env.RAILWAY_PROJECT_ID || "").trim() ||
      (process.env.RAILWAY_SERVICE_ID || "").trim(),
  );
}

/** 是否允許在正式環境使用啟動時隨機密鑰（重啟／重部署會使所有 session 失效） */
function ephemeralSecretAllowed(): boolean {
  const raw = (process.env.SESSION_USE_EPHEMERAL_SECRET || "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  // 未明確設定：僅在 Railway 上預設開啟，其餘 production 仍拋錯
  return isRailwayRuntime();
}

export function resolveSessionSecretForApp(): string {
  const isProd = process.env.NODE_ENV === "production";
  const secret = (process.env.SESSION_SECRET || "").trim();

  if (!isProd) {
    return secret || "dev-secret-key-marketing-judge";
  }

  // fail-fast：production 下 length < 32 且未允許暫用密鑰 → 拋錯（verify-batch6 靜態驗收字串）
  if (secret.length >= 32) {
    return secret;
  }

  if (ephemeralSecretAllowed()) {
    const generated = randomBytes(48).toString("base64url");
    console.warn(
      "[SESSION] 正式環境 SESSION_SECRET 未設或長度 <32；已使用啟動時隨機密鑰（重啟／重部署會登出所有使用者）。請在平台 Variables 設定 SESSION_SECRET（至少 32 字元）。若要改為未設即失敗，請設 SESSION_USE_EPHEMERAL_SECRET=false。",
    );
    return generated;
  }

  throw new Error("[SESSION] production requires SESSION_SECRET length >= 32");
}
