import type { Workflow } from "@shared/schema";

/** 一鍵轉任務預填 payload（對應 POST /api/workbench/tasks） */
export type TaskCreateFromJudgmentPayload = {
  title: string;
  action: string;
  reason: string;
  taskType?: string | null;
  priority?: string | null;
  taskSource?: string | null;
  productName?: string | null;
  creativeId?: string | null;
  impactAmount?: string | null;
  reviewSessionId?: string | null;
};

/** 審判官頁面可帶入的上下文（URL 參數或同頁狀態），用於一鍵轉任務預填 */
export type JudgmentContext = {
  sessionId: string | null;
  productName: string | null;
  creativeId: string | null;
  impactAmount: string | null;
};

export const ACCEPT_ATTACH =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm,video/quicktime";
export const MAX_ATTACH_SIZE_MB = 200;
export const MAX_ATTACH_SIZE = MAX_ATTACH_SIZE_MB * 1024 * 1024;
export const FILE_API_THRESHOLD_MB = 20;
export const FILE_API_THRESHOLD = FILE_API_THRESHOLD_MB * 1024 * 1024;
export const LAST_SESSION_KEY = "judgment-last-session-id";
export const DEFAULT_REVIEW_THRESHOLD = 85;

/** 外層三模式，對應後端片段組裝 */
export type UIMode = "boss" | "buyer" | "creative";

export const UI_MODE_TO_WORKFLOW: Record<UIMode, Workflow> = {
  boss: "audit",
  buyer: "strategy",
  creative: "create",
};

export const UI_MODE_LABELS: Record<UIMode, string> = {
  boss: "Boss 模式",
  buyer: "投手模式",
  creative: "創意模式",
};

export type EmptyEntry = {
  id: string;
  label: string;
  short: string;
  icon: string;
  mode: UIMode;
  workflow: Workflow;
  prompt?: string;
  placeholder?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
};

export const EMPTY_ENTRIES: EmptyEntry[] = [
  {
    id: "material",
    label: "素材審判",
    short: "圖片／影片／文案",
    icon: "👁️",
    mode: "creative",
    workflow: "audit",
    prompt: "總監，幫我用最嚴格的標準看這張圖/影片，前三秒會被滑掉嗎？該怎麼改？",
    placeholder: "貼上素材連結或上傳圖片／影片，描述想審的重點…",
    emptyTitle: "素材審判",
    emptySubtitle: "上傳素材或貼連結，總監會給出可執行的裁決與改版建議",
  },
  {
    id: "landing",
    label: "商品頁審判",
    short: "銷售頁架構與轉換",
    icon: "🛍️",
    mode: "boss",
    workflow: "create",
    prompt: "幫我針對這個產品，產出一個高轉換的銷售頁架構與各屏重點。",
    placeholder: "貼上商品頁網址或描述產品，產出銷售頁架構…",
    emptyTitle: "商品頁架構",
    emptySubtitle: "針對產品產出高轉換的銷售頁架構與各屏重點",
  },
  {
    id: "ads",
    label: "廣告數據審判",
    short: "廣告投放與成效",
    icon: "📊",
    mode: "buyer",
    workflow: "audit",
    prompt: "幫我抓出這篇文案的盲點，為什麼會騙點擊卻不轉換？",
    placeholder: "貼上廣告文案或數據，找出盲點與優化建議…",
    emptyTitle: "廣告數據審判",
    emptySubtitle: "從廣告數據找出騙點擊、不轉換的盲點與建議",
  },
  {
    id: "ga4",
    label: "GA4 漏斗審判",
    short: "漏斗斷點與優化",
    icon: "📈",
    mode: "buyer",
    workflow: "audit",
    prompt: "請從漏斗數據幫我找出斷點與優化建議。",
    placeholder: "描述漏斗現況或貼數據，找出斷點與優化…",
    emptyTitle: "GA4 漏斗審判",
    emptySubtitle: "從漏斗數據找出斷點與優化建議",
  },
];

export const WORKFLOW_LAYER_1: { workflow: Workflow; label: string }[] = [
  { workflow: "audit", label: "審判" },
  { workflow: "create", label: "產出" },
  { workflow: "strategy", label: "策略" },
  { workflow: "task", label: "任務" },
];

export function getSubtypesForWorkflow(w: Workflow): EmptyEntry[] {
  return EMPTY_ENTRIES.filter((e) => e.workflow === w);
}

export type PendingAttachment = {
  id: string;
  type: "image" | "video" | "pdf";
  name: string;
  mimeType: string;
  dataBase64?: string;
  fileUri?: string;
  preview?: string;
};

export const QUICK_PROMPTS: { id: string; icon: string; label: string; text: string; workflow: Workflow }[] = [
  {
    id: "material",
    icon: "👁️",
    label: "幫我看素材",
    text: "總監，幫我用最嚴格的標準看這張圖/影片，前三秒會被滑掉嗎？該怎麼改？",
    workflow: "audit",
  },
  {
    id: "salespage",
    icon: "🛍️",
    label: "產出銷售頁架構",
    text: "幫我針對這個產品，產出一個高轉換的銷售頁架構與各屏重點。",
    workflow: "create",
  },
  {
    id: "shortform",
    icon: "✍️",
    label: "發想痛點短影音",
    text: "幫我想 3 個最狠、最能引起共鳴的情緒痛點與短影音主標腳本。",
    workflow: "create",
  },
  {
    id: "blindspot",
    icon: "📊",
    label: "找出文案盲點",
    text: "幫我抓出這篇文案的盲點，為什麼會騙點擊卻不轉換？",
    workflow: "audit",
  },
];

export type ProblemType = "創意" | "商品頁" | "投放" | "漏斗" | null;
export const PROBLEM_TYPE_BADGES: Record<string, string> = {
  創意: "創意",
  商品頁: "商品頁",
  投放: "投放",
  漏斗: "漏斗",
};

/** 解析後的裁決骨架（前端固定分層） */
export type ParsedJudgment = {
  verdict: string;
  actionFirst: string;
  problemType: ProblemType;
  suggestTask: boolean | null;
  confidence: "high" | "medium" | "low" | null;
  reason: string;
  suggestions: string;
  evidence: string;
  impactAmount: string;
  score?: number;
  blockingReasons?: string[];
  pendingItems?: string[];
};

export const CONFIDENCE_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };
