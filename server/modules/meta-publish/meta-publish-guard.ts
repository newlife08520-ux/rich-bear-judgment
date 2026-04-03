/**
 * Meta Publish Stage1：在 EXECUTION_ALLOW_META_WRITES 之上再加功能旗標與（選用）帳號 allowlist。
 */
import {
  allowMetaWrites,
  META_WRITES_DISABLED_MESSAGE,
} from "../meta-execution/meta-execution-guard";

export { META_WRITES_DISABLED_MESSAGE };

export function isMetaPublishStage1Enabled(): boolean {
  const v = (process.env.META_PUBLISH_STAGE1_ENABLED ?? "").trim().toLowerCase();
  return v === "true" || v === "1";
}

/** Stage1 真寫入：需同時開啟 Meta 寫入與本旗標 */
export function allowMetaPublishStage1Writes(): boolean {
  return allowMetaWrites() && isMetaPublishStage1Enabled();
}

export const META_PUBLISH_STAGE1_DISABLED_MESSAGE =
  "Meta Publish Stage1 未啟用（需 EXECUTION_ALLOW_META_WRITES=true 且 META_PUBLISH_STAGE1_ENABLED=true）";

export const META_PUBLISH_ACCOUNT_NOT_ALLOWLISTED_MESSAGE =
  "廣告帳號不在 EXECUTION_META_WRITE_ACCOUNT_ALLOWLIST 內（Stage1 canary）";

/**
 * 若設 EXECUTION_META_WRITE_ACCOUNT_ALLOWLIST（逗號分隔 act_ 或純數字），僅允許列內廣告帳號寫入。
 * 未設定時不限制帳號（staging 預設）。
 */
export function allowMetaPublishForAccount(accountId: string): boolean {
  if (!allowMetaPublishStage1Writes()) return false;
  const raw = (process.env.EXECUTION_META_WRITE_ACCOUNT_ALLOWLIST ?? "").trim();
  if (!raw) return true;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const norm = String(accountId).replace(/^act_/i, "");
  return list.some((a) => a.replace(/^act_/i, "") === norm);
}

/** apply 前呼叫：丟出可讀錯誤 */
export function assertMetaPublishStage1Allowed(accountId: string): void {
  if (!allowMetaWrites()) {
    throw new Error(META_WRITES_DISABLED_MESSAGE);
  }
  if (!isMetaPublishStage1Enabled()) {
    throw new Error(META_PUBLISH_STAGE1_DISABLED_MESSAGE);
  }
  const raw = (process.env.EXECUTION_META_WRITE_ACCOUNT_ALLOWLIST ?? "").trim();
  if (!raw) return;
  if (!allowMetaPublishForAccount(accountId)) {
    throw new Error(META_PUBLISH_ACCOUNT_NOT_ALLOWLISTED_MESSAGE);
  }
}
