/**
 * 統一 Creative Identity：任務、生命週期、投放之間對同一支素材的穩定主鍵與解析。
 * 詳見 docs/creative-identity.md
 */

/** 生命週期維度目前以 campaign 為單位，canonical key = Meta campaignId */
export const CANONICAL_CREATIVE_KEY_LIFECYCLE = "campaignId" as const;

/** 任務欄位 creativeId 在「生命週期／campaign 脈絡」下應存 campaignId，以便與生命週期 item.id 對齊 */
export const TASK_CREATIVE_ID_SEMANTIC_FOR_LIFECYCLE = "campaignId" as const;

/**
 * 將任務的 creativeId 解析為生命週期用主鍵（用於深連結與 API 篩選）。
 * 目前生命週期 item.id = campaignId，故直接回傳 creativeId 作為 campaignId 使用。
 */
export function resolveTaskCreativeIdForLifecycle(creativeId: string | undefined | null): string | null {
  if (!creativeId || !creativeId.trim()) return null;
  return creativeId.trim();
}

/**
 * 比對生命週期 item 是否與任務 creativeId（視為 campaignId）匹配。
 * 優先精準匹配 item.id，避免僅依名稱包含。
 */
export function lifecycleItemMatchesCreativeKey(
  itemId: string,
  itemName: string,
  creativeKey: string
): boolean {
  const key = creativeKey.trim();
  if (itemId === key) return true;
  return itemName.toLowerCase().includes(key.toLowerCase());
}
