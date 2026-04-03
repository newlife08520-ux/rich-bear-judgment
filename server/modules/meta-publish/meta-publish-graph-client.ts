/**
 * Meta Marketing API：Stage1 最小連結廣告（PAUSED、單圖）。
 * 僅供 execution handler 呼叫；錯誤訊息需可回傳給操作者。
 */
import { readFile } from "fs/promises";
import * as path from "path";
import { resolveFilePathForRequest } from "../asset/upload-provider";

const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function formatGraphError(err: { message?: string; code?: number; error_subcode?: number }): string {
  const parts = [err.message ?? "Graph API 錯誤"];
  if (err.code != null) parts.push(`code=${err.code}`);
  if (err.error_subcode != null) parts.push(`subcode=${err.error_subcode}`);
  return parts.join(" ");
}

async function graphPost(
  relativePath: string,
  token: string,
  params: Record<string, string | number | undefined>
): Promise<Record<string, unknown>> {
  const url = `${GRAPH_BASE}/${relativePath.replace(/^\//, "")}`;
  const body = new URLSearchParams();
  body.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.set(k, typeof v === "number" ? String(v) : v);
  }
  const res = await fetch(url, { method: "POST", body });
  const json = (await res.json()) as { error?: { message?: string; code?: number; error_subcode?: number } } & Record<
    string,
    unknown
  >;
  if (json.error) {
    throw new Error(formatGraphError(json.error));
  }
  return json;
}

export async function graphDelete(objectId: string, token: string): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${objectId}`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), { method: "DELETE" });
  const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
  if (json.error && !json.success) {
    throw new Error(json.error.message ?? "Graph DELETE 失敗");
  }
}

/** 將 UI 中文 CTA 對應至 Meta call_to_action.type（Stage1 最小集合） */
export function mapCtaTypeZhToMeta(zh: string): string {
  const m: Record<string, string> = {
    來去逛逛: "SHOP_NOW",
    了解更多: "LEARN_MORE",
    立即購買: "SHOP_NOW",
    註冊: "SIGN_UP",
    聯絡我們: "CONTACT_US",
    下載: "DOWNLOAD",
    "申請 now": "APPLY_NOW",
    訂閱: "SUBSCRIBE",
    領取優惠: "GET_OFFER",
    立即預約: "BOOK_TRAVEL",
  };
  return m[zh] ?? "LEARN_MORE";
}

/** 中文目標 → Campaign objective + AdSet optimization_goal（Stage1：無 pixel／自訂受眾） */
export function mapObjectiveBundle(zh: string): { objective: string; optimizationGoal: string } {
  switch (zh) {
    case "轉換":
      return { objective: "OUTCOME_TRAFFIC", optimizationGoal: "LINK_CLICKS" };
    case "觸及":
    case "品牌知名度":
      return { objective: "OUTCOME_AWARENESS", optimizationGoal: "REACH" };
    case "互動":
      return { objective: "OUTCOME_ENGAGEMENT", optimizationGoal: "POST_ENGAGEMENT" };
    case "訊息":
      return { objective: "OUTCOME_ENGAGEMENT", optimizationGoal: "LINK_CLICKS" };
    default:
      throw new Error(`Stage1 不支援的 Campaign 目標：${zh}（請選擇精靈內建選項）`);
  }
}

function actPath(adAccountId: string): string {
  const id = String(adAccountId).replace(/^act_/i, "");
  return `act_${id}`;
}

export function parseUploadFilenameFromFileUrl(userId: string, fileUrl: string): string | null {
  const prefix = `/api/uploads/${userId}/`;
  if (!fileUrl.startsWith(prefix)) return null;
  const rest = fileUrl.slice(prefix.length);
  if (!rest || rest.includes("..") || rest.includes("/")) return null;
  return rest;
}

export async function readImageBytesForMeta(userId: string, fileUrl: string): Promise<{ bytes: Buffer; filename: string }> {
  const filename = parseUploadFilenameFromFileUrl(userId, fileUrl);
  if (!filename) {
    throw new Error("素材檔案 URL 非本機上傳路徑（Stage1 僅支援 /api/uploads/...）");
  }
  const diskPath = resolveFilePathForRequest(userId, filename);
  if (!diskPath) {
    throw new Error(`無法解析素材檔案路徑：${fileUrl}`);
  }
  const bytes = await readFile(diskPath);
  return { bytes, filename: path.basename(diskPath) };
}

export async function uploadAdImage(
  adAccountId: string,
  token: string,
  bytes: Buffer,
  uploadFilename: string
): Promise<string> {
  const fd = new FormData();
  fd.set("access_token", token);
  const blob = new Blob([new Uint8Array(bytes)]);
  fd.set("filename", blob, uploadFilename);
  const url = `${GRAPH_BASE}/${actPath(adAccountId)}/adimages`;
  const res = await fetch(url, { method: "POST", body: fd });
  const json = (await res.json()) as {
    error?: { message?: string; code?: number };
    images?: Record<string, { hash?: string }>;
  };
  if (json.error) {
    throw new Error(formatGraphError(json.error));
  }
  const first = json.images && Object.values(json.images)[0];
  const hash = first?.hash;
  if (!hash) {
    throw new Error("上傳圖片成功但未回傳 image hash");
  }
  return hash;
}

export async function createCampaignPaused(params: {
  adAccountId: string;
  token: string;
  name: string;
  objective: string;
}): Promise<string> {
  const json = await graphPost(`${actPath(params.adAccountId)}/campaigns`, params.token, {
    name: params.name,
    objective: params.objective,
    status: "PAUSED",
    special_ad_categories: "[]",
  });
  const id = json.id;
  if (typeof id !== "string") throw new Error("建立 Campaign 未回傳 id");
  return id;
}

export async function createAdSetPaused(params: {
  adAccountId: string;
  token: string;
  campaignId: string;
  name: string;
  dailyBudgetMinor: number;
  optimizationGoal: string;
}): Promise<string> {
  const targeting = JSON.stringify({
    geo_locations: { countries: ["TW"] },
  });
  const json = await graphPost(`${actPath(params.adAccountId)}/adsets`, params.token, {
    name: params.name,
    campaign_id: params.campaignId,
    status: "PAUSED",
    billing_event: "IMPRESSIONS",
    optimization_goal: params.optimizationGoal,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    daily_budget: params.dailyBudgetMinor,
    targeting,
  });
  const id = json.id;
  if (typeof id !== "string") throw new Error("建立 Ad Set 未回傳 id");
  return id;
}

export async function createLinkCreative(params: {
  adAccountId: string;
  token: string;
  name: string;
  pageId: string;
  imageHash: string;
  link: string;
  message: string;
  headline: string;
  ctaType: string;
}): Promise<string> {
  const object_story_spec = JSON.stringify({
    page_id: params.pageId,
    link_data: {
      link: params.link,
      message: params.message || " ",
      name: params.headline || " ",
      image_hash: params.imageHash,
      call_to_action: {
        type: params.ctaType,
        value: { link: params.link },
      },
    },
  });
  const json = await graphPost(`${actPath(params.adAccountId)}/adcreatives`, params.token, {
    name: params.name,
    object_story_spec,
  });
  const id = json.id;
  if (typeof id !== "string") throw new Error("建立 Creative 未回傳 id");
  return id;
}

export async function createAdPaused(params: {
  adAccountId: string;
  token: string;
  name: string;
  adsetId: string;
  creativeId: string;
}): Promise<string> {
  const creative = JSON.stringify({ creative_id: params.creativeId });
  const json = await graphPost(`${actPath(params.adAccountId)}/ads`, params.token, {
    name: params.name,
    adset_id: params.adsetId,
    creative,
    status: "PAUSED",
  });
  const id = json.id;
  if (typeof id !== "string") throw new Error("建立 Ad 未回傳 id");
  return id;
}

/**
 * 將草稿上的「元」預算轉成 Graph daily_budget 整數（帳號幣別最小單位；Stage1 假設與前端輸入同量級，下限 100）。
 */
export function toDailyBudgetMinorUnits(daily: number): number {
  const n = Math.round(Number(daily));
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("每日預算必須為正數");
  }
  return Math.max(100, n);
}
