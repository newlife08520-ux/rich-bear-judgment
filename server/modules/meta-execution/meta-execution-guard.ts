/**
 * Meta 寫入開關：僅在 EXECUTION_ALLOW_META_WRITES=true 時允許 apply
 */
export function allowMetaWrites(): boolean {
  const v = (process.env.EXECUTION_ALLOW_META_WRITES ?? "").trim().toLowerCase();
  return v === "true" || v === "1";
}

export const META_WRITES_DISABLED_MESSAGE =
  "Meta 寫入已停用（請設定 EXECUTION_ALLOW_META_WRITES=true 後再 apply）";
