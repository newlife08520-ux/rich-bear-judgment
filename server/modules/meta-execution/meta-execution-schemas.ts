/**
 * Meta 執行 payload 驗證（campaignId、budget 等）
 */
export function validateCampaignId(payload: unknown): asserts payload is { campaignId: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload 必須為物件");
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.campaignId !== "string" || !p.campaignId.trim()) {
    throw new Error("campaignId 必填");
  }
}

export function validateCampaignBudget(
  payload: unknown
): asserts payload is { campaignId: string; budgetDaily?: number; budgetTotal?: number } {
  validateCampaignId(payload);
  const p = payload as Record<string, unknown>;
  const hasDaily = p.budgetDaily != null && Number.isFinite(Number(p.budgetDaily));
  const hasTotal = p.budgetTotal != null && Number.isFinite(Number(p.budgetTotal));
  if (!hasDaily && !hasTotal) {
    throw new Error("請填寫 budgetDaily 或 budgetTotal");
  }
}
