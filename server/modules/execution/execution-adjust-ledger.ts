/**
 * 6.6-B：operator apply 成功後 best-effort 寫入 WorkbenchAdjustDaily（與 goal/pacing 的 product: 鍵對齊）。
 */
import { parseCampaignNameToTags } from "@shared/tag-aggregation-engine";

export function adjustTypeForAction(actionType: string): string {
  if (actionType === "meta_campaign_pause") return "pause_campaign";
  if (actionType === "meta_campaign_resume") return "resume_campaign";
  if (actionType === "meta_campaign_update_budget") return "budget_change";
  if (actionType === "meta_publish_draft_execute") return "publish_execute";
  if (actionType.startsWith("publish_draft_")) return "publish_draft";
  if (actionType === "task_create" || actionType.startsWith("task_")) return "task";
  const safe = actionType.replace(/[^a-z0-9_]/gi, "_").slice(0, 40);
  return safe || "execution_apply";
}

function addProductFromCampaignName(keys: Set<string>, campaignName: string | undefined | null): void {
  const cn = typeof campaignName === "string" ? campaignName.trim() : "";
  if (!cn) return;
  const tags = parseCampaignNameToTags(cn);
  if (tags?.productName) keys.add(`product:${tags.productName}`);
}

export function entityKeysFromExecutionPayload(payload: Record<string, unknown>): Set<string> {
  const keys = new Set<string>();
  const pn = typeof payload.productName === "string" ? payload.productName.trim() : "";
  if (pn) keys.add(`product:${pn}`);
  const cid = typeof payload.campaignId === "string" ? payload.campaignId.trim() : "";
  if (cid) keys.add(`campaign:${cid}`);
  const adsetId = typeof payload.adsetId === "string" ? payload.adsetId.trim() : "";
  if (adsetId) keys.add(`adset:${adsetId}`);
  const ek = typeof payload.entityKey === "string" ? payload.entityKey.trim() : "";
  if (ek) keys.add(ek);
  const arr = payload.entityKeys;
  if (Array.isArray(arr)) {
    for (const x of arr) {
      if (typeof x === "string" && x.trim()) keys.add(x.trim());
    }
  }
  addProductFromCampaignName(keys, typeof payload.campaignName === "string" ? payload.campaignName : null);
  return keys;
}

function mergeMetaKeys(
  keys: Set<string>,
  resultMeta: Record<string, unknown> | undefined
): void {
  if (!resultMeta) return;
  const ek = typeof resultMeta.entityKey === "string" ? resultMeta.entityKey.trim() : "";
  if (ek) keys.add(ek);
  const arr = resultMeta.entityKeys;
  if (Array.isArray(arr)) {
    for (const x of arr) {
      if (typeof x === "string" && x.trim()) keys.add(x.trim());
    }
  }
  addProductFromCampaignName(keys, typeof resultMeta.campaignName === "string" ? resultMeta.campaignName : null);
  const rcid = typeof resultMeta.campaignId === "string" ? resultMeta.campaignId.trim() : "";
  if (rcid) keys.add(`campaign:${rcid}`);
  const rad = typeof resultMeta.adsetId === "string" ? resultMeta.adsetId.trim() : "";
  if (rad) keys.add(`adset:${rad}`);
  const metaAs = typeof resultMeta.metaAdSetId === "string" ? resultMeta.metaAdSetId.trim() : "";
  if (metaAs) keys.add(`adset:${metaAs}`);
}

export async function appendAdjustLedgerAfterApply(params: {
  userId: string;
  actionType: string;
  payload: Record<string, unknown>;
  resultMeta?: Record<string, unknown>;
}): Promise<void> {
  const keys = entityKeysFromExecutionPayload(params.payload);
  mergeMetaKeys(keys, params.resultMeta);
  if (keys.size === 0) return;
  const { incrementAdjust } = await import("../creative-intelligence/workbench-adjust-prisma");
  const adjustType = adjustTypeForAction(params.actionType);
  for (const entityKey of keys) {
    try {
      await incrementAdjust({ userId: params.userId, entityKey, adjustType });
    } catch (e) {
      console.warn("[adjust-ledger]", entityKey, e);
    }
  }
}
