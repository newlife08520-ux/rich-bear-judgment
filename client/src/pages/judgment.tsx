import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Gavel,
  Send,
  Paperclip,
  Scale,
  Download,
  AlertTriangle,
  Loader2,
  X,
  FileText,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  History,
  Copy,
  ChevronDown,
  ChevronRight,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppScope } from "@/hooks/use-app-scope";
import { AccountExceptionsBlock } from "@/components/account-exceptions-block";
import type { ReviewSession, ChatMessage, StructuredJudgment } from "@shared/schema";
import { type Workflow, workflowLabels } from "@shared/schema";
import type { DecisionCardBlock } from "@shared/decision-cards-engine";

/** 一鍵轉任務預填 payload（對應 POST /api/workbench/tasks） */
type TaskCreateFromJudgmentPayload = {
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
type JudgmentContext = {
  sessionId: string | null;
  productName: string | null;
  creativeId: string | null;
  impactAmount: string | null;
};

const ACCEPT_ATTACH = "image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm,video/quicktime";
const MAX_ATTACH_SIZE_MB = 200;
const MAX_ATTACH_SIZE = MAX_ATTACH_SIZE_MB * 1024 * 1024;
/** 超過此大小改用 File API 上傳（避免 body 過大） */
const FILE_API_THRESHOLD_MB = 20;
const FILE_API_THRESHOLD = FILE_API_THRESHOLD_MB * 1024 * 1024;

const LAST_SESSION_KEY = "judgment-last-session-id";

/** 審核門檻：第一版由系統固定，不交給模型 */
const DEFAULT_REVIEW_THRESHOLD = 85;

/** 外層三模式，對應後端片段組裝 */
type UIMode = "boss" | "buyer" | "creative";

const UI_MODE_LABELS: Record<UIMode, string> = {
  boss: "Boss 模式",
  buyer: "投手模式",
  creative: "創意模式",
};

/** 空狀態四大入口；點擊時切換 workflow + uiMode 再帶入預設 prompt */
const EMPTY_ENTRIES: { id: string; label: string; short: string; icon: string; mode: UIMode; workflow: Workflow; prompt?: string }[] = [
  { id: "material", label: "素材審判", short: "圖片／影片／文案", icon: "👁️", mode: "creative", workflow: "audit", prompt: "總監，幫我用最嚴格的標準看這張圖/影片，前三秒會被滑掉嗎？該怎麼改？" },
  { id: "landing", label: "商品頁架構", short: "銷售頁架構與轉換", icon: "🛍️", mode: "boss", workflow: "create", prompt: "幫我針對這個產品，產出一個高轉換的銷售頁架構與各屏重點。" },
  { id: "ads", label: "廣告數據審判", short: "廣告投放與成效", icon: "📊", mode: "buyer", workflow: "audit", prompt: "幫我抓出這篇文案的盲點，為什麼會騙點擊卻不轉換？" },
  { id: "ga4", label: "GA4 漏斗審判", short: "漏斗斷點與優化", icon: "📈", mode: "buyer", workflow: "audit", prompt: "請從漏斗數據幫我找出斷點與優化建議。" },
];

type PendingAttachment = {
  id: string;
  type: "image" | "video" | "pdf";
  name: string;
  mimeType: string;
  dataBase64?: string;
  fileUri?: string;
  preview?: string;
};

const QUICK_PROMPTS: { id: string; icon: string; label: string; text: string }[] = [
  { id: "material", icon: "👁️", label: "幫我看素材", text: "總監，幫我用最嚴格的標準看這張圖/影片，前三秒會被滑掉嗎？該怎麼改？" },
  { id: "salespage", icon: "🛍️", label: "產出銷售頁架構", text: "幫我針對這個產品，產出一個高轉換的銷售頁架構與各屏重點。" },
  { id: "shortform", icon: "✍️", label: "發想痛點短影音", text: "幫我想 3 個最狠、最能引起共鳴的情緒痛點與短影音主標腳本。" },
  { id: "blindspot", icon: "📊", label: "找出文案盲點", text: "幫我抓出這篇文案的盲點，為什麼會騙點擊卻不轉換？" },
];

/** 問題類型 */
type ProblemType = "創意" | "商品頁" | "投放" | "漏斗" | null;
const PROBLEM_TYPE_BADGES: Record<string, string> = { 創意: "創意", 商品頁: "商品頁", 投放: "投放", 漏斗: "漏斗" };

/** 解析後的裁決骨架（前端固定分層） */
type ParsedJudgment = {
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

const CONFIDENCE_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

/** 結構化 confidence（高/中/低）→ 前端用的 high/medium/low */
function structuredConfidenceToKey(c: StructuredJudgment["confidence"]): ParsedJudgment["confidence"] {
  if (!c) return null;
  if (c === "高") return "high";
  if (c === "中") return "medium";
  if (c === "低") return "low";
  return null;
}

/** 後端結構化欄位 → 前端裁決骨架（供摘要卡與一鍵轉任務使用）。passed 由系統依 score >= threshold 計算，不從模型來。 */
function mapStructuredToParsed(s: StructuredJudgment): ParsedJudgment {
  return {
    verdict: s.summary ?? "",
    actionFirst: s.nextAction ?? "",
    problemType: s.problemType ?? null,
    suggestTask: s.recommendTask ?? null,
    confidence: structuredConfidenceToKey(s.confidence),
    reason: s.reasons ?? "",
    suggestions: s.suggestions ?? "",
    evidence: s.evidence ?? "",
    impactAmount: s.impactAmount ?? "",
    score: s.score,
    blockingReasons: s.blockingReasons,
    pendingItems: s.pendingItems,
  };
}

/** 從 AI 長文解析出固定區塊；無結構時盡力提取總判決、建議動作、關鍵理由（fallback）。舊資料無 score 時不填。 */
function parseJudgmentContent(raw: string): ParsedJudgment {
  const out: ParsedJudgment = {
    verdict: "",
    actionFirst: "",
    problemType: null,
    suggestTask: null,
    confidence: null,
    reason: "",
    suggestions: "",
    evidence: "",
    impactAmount: "",
  };
  const text = raw.trim();
  if (!text) return out;

  const sections = new Map<string, string>();
  const headerRegex = /^#{1,3}\s*(.+?)\s*$/gm;
  let lastEnd = 0;
  let lastTitle = "";
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(text)) !== null) {
    if (lastTitle) {
      const body = text.slice(lastEnd, match.index).trim();
      if (body) sections.set(lastTitle, body);
    }
    lastTitle = match[1].trim().replace(/\s+/g, " ");
    lastEnd = match.index + match[0].length;
  }
  if (lastTitle) {
    const body = text.slice(lastEnd).trim();
    if (body) sections.set(lastTitle, body);
  }

  const get = (keys: string[]) => {
    for (const k of keys) {
      if (sections.has(k)) return sections.get(k)!;
    }
    for (const [title, body] of sections) {
      if (keys.some((k) => title.includes(k) || k.includes(title))) return body;
    }
    return "";
  };

  out.verdict = get(["一句總判決", "總判決", "判決", "結論"]) || sections.values().next().value?.split(/\n\n/)[0]?.trim() || "";
  out.actionFirst = get(["先做什麼", "建議動作", "建議", "行動建議"]) || "";
  const problemRaw = get(["問題類型", "類型"]);
  if (/創意|素材|影片|圖片/i.test(problemRaw)) out.problemType = "創意";
  else if (/商品頁|銷售頁|落地頁/i.test(problemRaw)) out.problemType = "商品頁";
  else if (/投放|廣告|文案/i.test(problemRaw)) out.problemType = "投放";
  else if (/漏斗|ga4|轉換/i.test(problemRaw)) out.problemType = "漏斗";
  out.reason = get(["詳細原因", "原因", "為什麼", "分析"]) || "";
  out.suggestions = get(["具體建議", "建議事項"]) || (out.actionFirst ? "" : get(["建議"]));
  out.evidence = get(["證據與指標", "證據", "指標", "數據"]) || "";
  const impactSection = get(["影響金額", "影響", "impactAmount"]);
  if (impactSection) out.impactAmount = impactSection.trim().slice(0, 80);

  const suggestRaw = get(["是否建議生成任務", "生成任務"]) || text;
  out.suggestTask = /是|建議|可產|生成任務/i.test(suggestRaw) && !/不建議|暫不/i.test(suggestRaw) ? true : /否|不建議/i.test(suggestRaw) ? false : null;
  const confRaw = get(["置信度"]) || text;
  if (/高|high/i.test(confRaw)) out.confidence = "high";
  else if (/中|medium/i.test(confRaw)) out.confidence = "medium";
  else if (/低|low/i.test(confRaw)) out.confidence = "low";

  if (!out.verdict && !sections.size) {
    const firstPara = text.split(/\n\n+/)[0]?.trim() ?? "";
    const firstSentence = firstPara.split(/[。！？]/)[0]?.trim() ?? firstPara.slice(0, 120);
    out.verdict = firstSentence;
    const bulletMatch = text.match(/(?:^|\n)([-*•]\s*.+|\d+[.)]\s*.+)(?:\n(?:[-*•]|\d+[.)]).+)*/gm);
    if (bulletMatch?.length) out.actionFirst = bulletMatch.slice(0, 5).join("\n").trim();
    out.reason = text.replace(firstPara, "").replace(out.actionFirst, "").trim().slice(0, 2000);
  }

  if (!out.impactAmount) {
    const fromText = extractAmountFromText(out.reason + " " + out.evidence + " " + out.verdict);
    if (fromText) out.impactAmount = fromText;
  }
  return out;
}

/** 從文字推導影響金額（與後端規則一致：約 N 萬、N 萬、NT$、影響...萬） */
function extractAmountFromText(t: string): string {
  if (!t?.trim()) return "";
  const s = t.trim();
  const aboutWan = s.match(/(?:約|大約|估計)\s*(\d+(?:\.\d+)?)\s*萬/);
  if (aboutWan) return `約 ${aboutWan[1]} 萬`;
  const wan = s.match(/(\d+(?:\.\d+)?)\s*萬/);
  if (wan) return `${wan[1]} 萬`;
  const nt = s.match(/NT\s*\$?\s*[\d,]+(?:\s*元)?/);
  if (nt) return nt[0].trim();
  const impact = s.match(/影響[^\d]*(\d+(?:\.\d+)?)\s*萬/);
  if (impact) return `約 ${impact[1]} 萬`;
  return "";
}

/** 問題類型 → 任務類型（對應 workbench taskType） */
const PROBLEM_TYPE_TO_TASK_TYPE: Record<NonNullable<ProblemType>, string> = {
  創意: "creative",
  商品頁: "landing_page",
  投放: "fb_ads",
  漏斗: "ga4_funnel",
};

/** 單則裁決的標題與內文（用於固定結構裁決報告） */
function getParsedForMessage(message: ChatMessage): ParsedJudgment {
  return message.structuredJudgment != null
    ? mapStructuredToParsed(message.structuredJudgment)
    : parseJudgmentContent(message.content);
}

/** 轉任務時收斂欄位：一句明確任務、執行動作、簡短原因，避免過長造成列表難讀 */
function buildTaskPayloadFromParsed(
  parsed: ParsedJudgment,
  ctx: JudgmentContext
): TaskCreateFromJudgmentPayload {
  const title = (parsed.verdict || "審判建議").replace(/\s+/g, " ").trim().slice(0, 60) || "審判建議";
  const actionLine = parsed.actionFirst.split(/\n/)[0]?.trim() || parsed.actionFirst.trim();
  const action = actionLine.slice(0, 150) || "請見完整內容";
  const reason = (parsed.reason || parsed.suggestions).replace(/\s+/g, " ").trim().slice(0, 300) || "";
  return {
    title,
    action,
    reason,
    taskType: parsed.problemType ? PROBLEM_TYPE_TO_TASK_TYPE[parsed.problemType] : null,
    priority: parsed.confidence ?? null,
    taskSource: "審判官",
    productName: ctx.productName ?? null,
    creativeId: ctx.creativeId ?? null,
    impactAmount: (parsed.impactAmount && parsed.impactAmount.trim()) ? parsed.impactAmount.trim() : (ctx.impactAmount ?? null),
    reviewSessionId: ctx.sessionId ?? null,
  };
}

/** 存為此活動初審：輸入 campaignId 後寫入 initial-verdicts-store，供生命週期中心顯示。 */
function SaveAsInitialVerdictBlock({
  parsed,
  hasScore,
  passed,
}: {
  parsed: ParsedJudgment;
  hasScore: boolean;
  passed: boolean;
}) {
  const [campaignIdInput, setCampaignIdInput] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const handleSave = async () => {
    const campaignId = campaignIdInput.trim();
    if (!campaignId) {
      toast({ title: "請輸入活動／素材 ID (campaignId)", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/judgment/save-initial-verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          campaignId,
          score: parsed.score ?? 0,
          summary: parsed.verdict || "",
          recommendTest: parsed.suggestTask ?? (hasScore && passed),
          reason: (parsed.actionFirst || parsed.reason || "").slice(0, 500),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "儲存失敗");
      }
      toast({ title: "已存為此活動初審判決", duration: 2000 });
      setCampaignIdInput("");
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "儲存失敗", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="活動/素材 ID (campaignId)"
        value={campaignIdInput}
        onChange={(e) => setCampaignIdInput(e.target.value)}
        className="h-8 w-44 text-xs"
        data-testid="input-save-initial-verdict-campaign-id"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 h-8"
        onClick={handleSave}
        disabled={saving}
        data-testid="button-save-initial-verdict"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        存為初審
      </Button>
    </div>
  );
}

/** 裁決工作台：固定骨架卡片；頂部三主動作（匯出報告、轉為任務、審核結果）、審核區塊、收斂轉任務。 */
function JudgmentWorkbenchBubble({
  message,
  judgmentContext,
  onCreateTask,
  onExportReport,
  auditBlockId,
}: {
  message: ChatMessage;
  judgmentContext?: JudgmentContext | null;
  onCreateTask?: (payload: TaskCreateFromJudgmentPayload) => void;
  onExportReport?: (msg: ChatMessage) => void;
  auditBlockId?: string;
}) {
  const ctx = judgmentContext ?? { sessionId: null, productName: null, creativeId: null, impactAmount: null };
  const parsed = getParsedForMessage(message);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const hasEvidence = parsed.evidence.trim().length > 0;
  const evidencePreview = parsed.evidence.trim().slice(0, 80) + (parsed.evidence.length > 80 ? "…" : "");

  const hasScore = typeof parsed.score === "number";
  const passed = hasScore && parsed.score! >= DEFAULT_REVIEW_THRESHOLD;

  return (
    <div className="flex justify-start w-full max-w-3xl">
      <div className="w-full space-y-3">
        {/* 頂部摘要卡：三主動作 + 一句總判決 + 先做什麼 + 審核區塊（有 score 時） */}
        <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
          <CardContent className="p-4 space-y-3">
            {/* 三主動作：匯出報告、轉為任務、審核結果 */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
              {onExportReport && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onExportReport(message)}
                  data-testid="button-export-report"
                >
                  <FileText className="w-3.5 h-3.5" />
                  匯出報告
                </Button>
              )}
              {onCreateTask && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onCreateTask(buildTaskPayloadFromParsed(parsed, ctx))}
                  data-testid="button-create-task"
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  轉為任務
                </Button>
              )}
              <SaveAsInitialVerdictBlock parsed={parsed} hasScore={hasScore} passed={passed} />
              {auditBlockId ? (
                hasScore ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => document.getElementById(auditBlockId)?.scrollIntoView({ behavior: "smooth" })}
                  >
                    審核結果
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground px-2 py-1.5" title="本則無評分">審核結果（本則無評分）</span>
                )
              ) : null}
            </div>

            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">一句總判決</p>
                <p className="text-base font-semibold text-gray-900 leading-snug">
                  {parsed.verdict || "（無法自動擷取，請見下方詳細內容）"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {parsed.problemType && (
                  <Badge variant="secondary" className="text-xs">
                    {PROBLEM_TYPE_BADGES[parsed.problemType]}
                  </Badge>
                )}
                {parsed.confidence && (
                  <Badge variant="outline" className="text-xs">
                    置信度 {CONFIDENCE_LABELS[parsed.confidence]}
                  </Badge>
                )}
                {parsed.suggestTask === true && (
                  <Badge className="text-xs bg-primary/15 text-primary border-0">建議產任務</Badge>
                )}
              </div>
            </div>

            {parsed.actionFirst && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">先做什麼</p>
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{parsed.actionFirst}</div>
              </div>
            )}

            {/* 審核區塊：有 score 時顯示綜合分數、門檻、通過/未通過、blockingReasons、pendingItems */}
            {hasScore && (
              <div id={auditBlockId} className="border-t border-gray-200 pt-3 space-y-2 rounded-md bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">審核結果</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-gray-600">綜合分數</span>
                  <span className="font-medium">{parsed.score}</span>
                  <span className="text-gray-600">門檻分數</span>
                  <span className="font-medium">{DEFAULT_REVIEW_THRESHOLD}</span>
                  <span className="text-gray-600">結果</span>
                  <span className={passed ? "font-medium text-green-700" : "font-medium text-amber-700"}>
                    {passed ? "通過" : "未通過"}
                  </span>
                </div>
                {parsed.blockingReasons && parsed.blockingReasons.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-0.5">阻擋原因</p>
                    <ul className="list-disc list-inside text-sm text-gray-800 space-y-0.5">
                      {parsed.blockingReasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {parsed.pendingItems && parsed.pendingItems.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-0.5">待辦／待補</p>
                    <ul className="list-disc list-inside text-sm text-gray-800 space-y-0.5">
                      {parsed.pendingItems.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 詳細原因 */}
        {(parsed.reason || parsed.suggestions) && (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4 space-y-3">
              {parsed.reason && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">詳細原因</p>
                  <div
                    className="prose prose-gray max-w-none prose-sm text-gray-700 prose-p:my-1 prose-ul:my-1 prose-ol:my-1"
                    data-print-content={message.id}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.reason}</ReactMarkdown>
                  </div>
                </div>
              )}
              {parsed.suggestions && (
                <div className={parsed.reason ? "border-t border-gray-100 pt-3" : ""}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">具體建議</p>
                  <div className="prose prose-gray max-w-none prose-sm text-gray-700 prose-p:my-1 prose-ul:my-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.suggestions}</ReactMarkdown>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 無結構時：整段以 prose 顯示在原因區下方 */}
        {!parsed.verdict && !parsed.reason && !parsed.suggestions && (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div
                className="prose prose-gray max-w-none prose-sm text-gray-700 prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
                data-print-content={message.id}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 證據與指標：摘要 + 可展開 */}
        {hasEvidence && (
          <Collapsible open={evidenceOpen} onOpenChange={setEvidenceOpen}>
            <Card className="bg-white border-gray-200 shadow-sm">
              <CollapsibleTrigger asChild>
                <button className="w-full p-4 flex items-center justify-between gap-2 text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">證據與指標</span>
                    <span className="text-xs text-gray-400">{evidencePreview}</span>
                  </div>
                  {evidenceOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 border-t border-gray-100">
                  <div className="prose prose-gray max-w-none prose-sm text-gray-600 prose-p:my-1 prose-table:my-2 mt-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.evidence}</ReactMarkdown>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white shadow-sm border border-gray-200 px-5 py-4">
        <div
          className="prose prose-gray max-w-none prose-base leading-relaxed text-gray-800 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:mb-2 prose-headings:mt-4 prose-headings:font-semibold prose-headings:text-gray-900 prose-strong:font-semibold prose-strong:text-gray-900 prose-table:my-3"
          data-print-content={message.id}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 shadow-sm">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 || "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const REPORT_STYLES = `
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  body { font-family: system-ui, "Segoe UI", "Microsoft JhengHei", sans-serif; padding: 0; margin: 0; color: #1a1a1a; line-height: 1.7; }
  .print-header { padding: 16px 24px; border-bottom: 2px solid #e5e5e5; margin-bottom: 20px; }
  .print-header .title { font-size: 1.25rem; font-weight: 700; }
  .print-header .meta { font-size: 0.875rem; color: #666; margin-top: 4px; }
  .content { padding: 0 24px 24px; max-width: 720px; margin: 0 auto; }
  .report-block { page-break-inside: avoid; margin-bottom: 1.5em; padding: 12px 0; border-bottom: 1px solid #eee; }
  .report-block:last-child { border-bottom: 0; }
  .report-block h2 { font-size: 1rem; color: #666; margin: 0 0 4px 0; font-weight: 600; }
  .report-block .value { font-size: 0.95rem; margin-bottom: 12px; white-space: pre-wrap; }
  .report-block ul { margin: 0.25em 0; padding-left: 1.5em; }
  .report-block li { margin: 0.2em 0; }
  .footer { margin-top: 2em; font-size: 12px; color: #666; padding: 0 24px 24px; }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 單則裁決 → 固定結構裁決報告區塊 HTML（總判決、分數/是否通過、先做什麼、詳細原因、具體建議、證據與指標、影響金額） */
function buildReportBlockHtml(parsed: ParsedJudgment, index: number): string {
  const hasScore = typeof parsed.score === "number";
  const passed = hasScore && parsed.score! >= DEFAULT_REVIEW_THRESHOLD;
  const sections: string[] = [];

  sections.push(`<div class="report-block"><h2>總判決</h2><div class="value">${escapeHtml(parsed.verdict || "—")}</div></div>`);

  if (hasScore) {
    sections.push(
      `<div class="report-block"><h2>分數／是否通過</h2><div class="value">綜合分數 ${parsed.score}，門檻 ${DEFAULT_REVIEW_THRESHOLD}，${passed ? "通過" : "未通過"}</div></div>`
    );
  }

  sections.push(`<div class="report-block"><h2>先做什麼</h2><div class="value">${escapeHtml(parsed.actionFirst || "—")}</div></div>`);
  sections.push(`<div class="report-block"><h2>詳細原因</h2><div class="value">${escapeHtml(parsed.reason || "—")}</div></div>`);
  sections.push(`<div class="report-block"><h2>具體建議</h2><div class="value">${escapeHtml(parsed.suggestions || "—")}</div></div>`);
  sections.push(`<div class="report-block"><h2>證據與指標</h2><div class="value">${escapeHtml(parsed.evidence || "—")}</div></div>`);
  if (parsed.impactAmount?.trim()) {
    sections.push(`<div class="report-block"><h2>影響金額</h2><div class="value">${escapeHtml(parsed.impactAmount)}</div></div>`);
  }
  if (parsed.blockingReasons?.length) {
    sections.push(
      `<div class="report-block"><h2>阻擋原因</h2><ul>${parsed.blockingReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul></div>`
    );
  }
  if (parsed.pendingItems?.length) {
    sections.push(
      `<div class="report-block"><h2>待辦／待補</h2><ul>${parsed.pendingItems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul></div>`
    );
  }

  const title = index > 0 ? `裁決 ${index + 1}` : "裁決";
  return `<div class="report-section"><h2 style="font-size:1.1rem; margin-bottom:8px;">${title}</h2>${sections.join("")}</div>`;
}

/** 整場 session 的固定結構裁決報告 HTML */
function buildReportHtmlFromSession(session: ReviewSession): string {
  const assistantMessages = session.messages.filter((m) => m.role === "assistant");
  const blocks = assistantMessages.map((m, i) => buildReportBlockHtml(getParsedForMessage(m), i));
  return blocks.join("");
}

/** 單則訊息的裁決報告 HTML（用於卡片上的「匯出報告」） */
function buildReportHtmlFromMessage(message: ChatMessage): string {
  const parsed = getParsedForMessage(message);
  return buildReportBlockHtml(parsed, 0);
}

function openReportPrintWindow(title: string, meta: string, bodyHtml: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const dateStr = new Date().toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <div class="print-header">
    <div class="title">👑 裁決報告 — Rich Bear 華麗熊</div>
    <div class="meta">${escapeHtml(meta)} · ${dateStr}</div>
  </div>
  <div class="content">${bodyHtml}</div>
  <p class="footer">AI 行銷總監 · ${dateStr}</p>
</body>
</html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 300);
}

/** 匯出整場對話為固定結構裁決報告 PDF（不再抓 DOM） */
function exportFullSessionAsPdf(session: ReviewSession) {
  const assistantMessages = session.messages.filter((m) => m.role === "assistant");
  if (assistantMessages.length === 0) return;
  const bodyHtml = buildReportHtmlFromSession(session);
  openReportPrintWindow(session.title || "內容判讀", session.title || "裁決報告", bodyHtml);
}

/** 匯出單則裁決為固定結構裁決報告 PDF */
function exportSingleMessageAsPdf(message: ChatMessage, sessionTitle: string) {
  const bodyHtml = buildReportHtmlFromMessage(message);
  openReportPrintWindow(sessionTitle || "單則裁決", sessionTitle || "裁決報告", bodyHtml);
}

/** 從 location 字串解析查詢參數（審判官上下文：商品名、素材 ID、影響金額等） */
function parseJudgmentUrlParams(loc: string): { productName: string | null; creativeId: string | null; impactAmount: string | null } {
  const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  return {
    productName: params.get("productName")?.trim() || null,
    creativeId: params.get("creativeId")?.trim() || null,
    impactAmount: params.get("impactAmount")?.trim() || null,
  };
}

export default function JudgmentPage() {
  const [location, setLocation] = useLocation();
  const sessionIdFromUrl = (() => {
    const match = location.match(/\?sessionId=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  })();
  const urlContext = parseJudgmentUrlParams(location);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [inputText, setInputText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [uiMode, setUiMode] = useState<UIMode>("creative");
  const [workflow, setWorkflow] = useState<Workflow>("clarify");

  const scope = useAppScope();
  const decisionCardsParams = new URLSearchParams();
  if (scope.selectedAccountIds?.length) decisionCardsParams.set("scopeAccountIds", scope.selectedAccountIds.join(","));

  const { data: decisionCardsData } = useQuery({
    queryKey: ["/api/workbench/decision-cards", decisionCardsParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/workbench/decision-cards?${decisionCardsParams.toString()}`, { credentials: "include" });
      if (!res.ok) return { cards: [] };
      return res.json();
    },
  });
  const decisionCards: DecisionCardBlock[] = decisionCardsData?.cards ?? [];

  const { data: sessionsList = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["/api/review-sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/review-sessions");
      return res.json();
    },
  });

  const { data: fetchedSession, isLoading: loadingSession } = useQuery({
    queryKey: ["/api/review-sessions", sessionIdFromUrl],
    queryFn: async () => {
      if (!sessionIdFromUrl) return null;
      const res = await apiRequest("GET", `/api/review-sessions/${sessionIdFromUrl}`);
      return res.json();
    },
    enabled: !!sessionIdFromUrl,
  });

  const queryClient = useQueryClient();
  const createTaskMutation = useMutation({
    mutationFn: async (body: TaskCreateFromJudgmentPayload) => {
      const res = await fetch("/api/workbench/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: body.title,
          action: body.action,
          reason: body.reason,
          taskType: body.taskType ?? undefined,
          priority: body.priority ?? undefined,
          taskSource: body.taskSource ?? undefined,
          productName: body.productName ?? undefined,
          creativeId: body.creativeId ?? undefined,
          impactAmount: body.impactAmount ?? undefined,
          reviewSessionId: body.reviewSessionId ?? undefined,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("建立任務失敗");
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      toast({ title: "已建立任務", description: "前往任務中心", duration: 3000 });
      setLocation(`/tasks?highlight=${encodeURIComponent(data.id)}`);
    },
    onError: () => {
      toast({ variant: "destructive", title: "建立任務失敗" });
    },
  });

  const handleCreateTaskFromJudgment = useCallback(
    (payload: TaskCreateFromJudgmentPayload) => {
      createTaskMutation.mutate(payload);
    },
    [createTaskMutation]
  );

  const filteredSessions = historySearch.trim()
    ? sessionsList.filter(
        (s: ReviewSession) =>
          (s.title || "").toLowerCase().includes(historySearch.trim().toLowerCase())
      )
    : sessionsList;

  useEffect(() => {
    if (fetchedSession) {
      setSession(fetchedSession);
      try {
        localStorage.setItem(LAST_SESSION_KEY, fetchedSession.id);
      } catch {}
    } else if (!sessionIdFromUrl) {
      setSession(null);
    }
  }, [fetchedSession, sessionIdFromUrl]);

  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (sessionIdFromUrl || loadingSession || hasRestoredRef.current || !sessionsList?.length) return;
    try {
      const lastId = localStorage.getItem(LAST_SESSION_KEY);
      if (lastId && sessionsList.some((s: ReviewSession) => s.id === lastId)) {
        hasRestoredRef.current = true;
        setLocation(`/judgment?sessionId=${encodeURIComponent(lastId)}`, { replace: true });
      }
    } catch {}
  }, [sessionIdFromUrl, loadingSession, sessionsList, setLocation]);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages?.length, isSubmitting, scrollToBottom]);

  const messages = session?.messages ?? [];
  const canSubmit = (inputText.trim().length > 0 || attachments.length > 0) && !isSubmitting;

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        if (file.size > MAX_ATTACH_SIZE) {
          toast({
            variant: "destructive",
            title: "檔案過大",
            description: `${file.name} 超過 ${MAX_ATTACH_SIZE_MB}MB，請縮小後再上傳`,
          });
          continue;
        }
        const isPdf = file.type === "application/pdf";
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isPdf && !isImage && !isVideo) {
          toast({
            variant: "destructive",
            title: "不支援的格式",
            description: "僅支援圖片、PDF、影片 (mp4/webm 等)",
          });
          continue;
        }
        const type: "image" | "video" | "pdf" = isPdf ? "pdf" : isVideo ? "video" : "image";
        if (file.size > FILE_API_THRESHOLD) {
          try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/content-judgment/upload-file", {
              method: "POST",
              body: form,
              credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
              toast({
                variant: "destructive",
                title: "上傳失敗",
                description: data.message || "大檔案上傳失敗，請稍後再試",
              });
              continue;
            }
            setAttachments((prev) => [
              ...prev,
              {
                id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type,
                name: file.name,
                mimeType: file.type,
                fileUri: data.fileUri,
                preview: isImage ? undefined : undefined,
              },
            ]);
          } catch (e) {
            toast({ variant: "destructive", title: "上傳失敗", description: "請檢查連線後再試" });
          }
          continue;
        }
        try {
          const dataBase64 = await fileToBase64(file);
          let preview: string | undefined;
          if (isImage) preview = `data:${file.type};base64,${dataBase64}`;
          setAttachments((prev) => [
            ...prev,
            {
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type,
              name: file.name,
              mimeType: file.type,
              dataBase64,
              preview,
            },
          ]);
        } catch (e) {
          toast({ variant: "destructive", title: "讀取失敗", description: `無法讀取 ${file.name}` });
        }
      }
    },
    [toast],
  );

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if ((!content && attachments.length === 0) || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const messageAttachments = attachments.length
      ? attachments.map((a) => ({
          type: a.type,
          mimeType: a.mimeType,
          name: a.name,
          ...(a.fileUri ? { fileUri: a.fileUri } : { data: a.dataBase64 }),
        }))
      : undefined;

    try {
      const res = await fetch("/api/content-judgment/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
          uiMode,
          workflow,
          message: { content: content || "（僅附檔，請總監根據附件內容審視）", attachments: messageAttachments },
        }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = (data && typeof data.message === "string" ? data.message : null) || "送出失敗，請稍後再試";
        if (data && data.errorCode === "NO_API_KEY") {
          toast({
            variant: "destructive",
            title: "尚未設定 API Key",
            description: "請到「設定」頁面輸入 AI API Key（Gemini）後再試",
          });
        } else {
          toast({ variant: "destructive", title: "送出失敗", description: errMsg });
        }
        setSubmitError(errMsg);
        return;
      }

      setSession(data.session);
      setInputText("");
      setAttachments([]);
      if (data.workflow) setWorkflow(data.workflow);
      if (!session?.id && data.session?.id) {
        setLocation(`/judgment?sessionId=${data.session.id}`, { replace: true });
      }
    } catch (e) {
      console.error(e);
      setSubmitError("網路錯誤，請稍後再試");
      toast({ variant: "destructive", title: "送出失敗", description: "請檢查連線後再試" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewChat = () => {
    try {
      localStorage.removeItem(LAST_SESSION_KEY);
    } catch {}
    setSession(null);
    setInputText("");
    setAttachments([]);
    setWorkflow("clarify");
    setSubmitError(null);
    setLocation("/judgment", { replace: true });
  };

  const handleExportFullReport = () => {
    if (!session?.messages?.length) {
      toast({ title: "尚無對話", description: "請先進行對話再匯出報告" });
      return;
    }
    exportFullSessionAsPdf(session);
  };

  const handleExportSingleReport = (msg: ChatMessage) => {
    exportSingleMessageAsPdf(msg, session?.title ?? "裁決");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) handleSend();
    }
  };

  const handleQuickPrompt = (text: string) => {
    setInputText(text);
    setSubmitError(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSelectSession = (s: ReviewSession) => {
    setLocation(`/judgment?sessionId=${encodeURIComponent(s.id)}`, { replace: true });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white shrink-0 no-print">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => setHistoryOpen((o) => !o)}
          aria-label={historyOpen ? "收合歷史" : "展開歷史"}
        >
          {historyOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          <History className="w-4 h-4" />
          <span className="hidden sm:inline">{historyOpen ? "收合歷史" : "查看更多歷史"}</span>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="page-title truncate" data-testid="text-page-title">RICH BEAR 審判官</h1>
          <p className="text-xs text-muted-foreground truncate">王牌爆款陪跑行銷總監｜判讀素材、頁面、廣告與漏斗</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportFullReport}
          className="gap-1.5 no-print"
          data-testid="button-export-full-report"
        >
          <Download className="w-3.5 h-3.5" />
          📄 匯出裁決報告
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          className="gap-1.5"
          data-testid="button-new-chat"
        >
          <Scale className="w-3.5 h-3.5" />
          新對話
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => setRightPanelOpen((o) => !o)}
          aria-label={rightPanelOpen ? "收合右側" : "展開右側"}
        >
          {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
          <span className="hidden sm:inline">證據</span>
        </Button>
      </header>

      <div className="flex flex-1 min-h-0">
        {historyOpen && (
          <aside className="w-64 border-r border-gray-200 bg-white shrink-0 flex flex-col min-h-0 no-print">
            <div className="p-2 border-b shrink-0">
              <Input
                type="search"
                placeholder="搜尋歷史對話…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="h-9"
              />
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="flex flex-col">
                <ul className="p-2 space-y-0.5 shrink-0">
                  {loadingSessions ? (
                    <li className="py-4 text-center text-muted-foreground text-sm">載入中…</li>
                  ) : filteredSessions.length === 0 ? (
                    <li className="py-4 text-center text-muted-foreground text-sm">尚無歷史對話</li>
                  ) : (
                    filteredSessions.map((s: ReviewSession) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectSession(s)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate block ${
                            session?.id === s.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                          data-testid={`session-${s.id}`}
                        >
                          <span className="block truncate">{s.title || "未命名"}</span>
                          <span className="block text-xs opacity-80 mt-0.5">
                            {new Date(s.updatedAt).toLocaleDateString("zh-TW", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="p-2 border-t border-gray-200 dark:border-slate-700 mt-auto space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">常用審判模式</p>
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(UI_MODE_LABELS) as UIMode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setUiMode(m)}
                          className={`text-xs px-2 py-1 rounded shrink-0 ${uiMode === m ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                        >
                          {UI_MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">最近使用模板</p>
                    <div className="flex flex-col gap-0.5">
                      {QUICK_PROMPTS.slice(0, 4).map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => handleQuickPrompt(q.text)}
                          className="text-xs text-left px-2 py-1.5 rounded hover:bg-muted truncate"
                        >
                          {q.icon} {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">快速上傳素材</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs w-full px-2 py-1.5 rounded bg-muted hover:bg-muted/80 flex items-center gap-1"
                    >
                      <Paperclip className="w-3 h-3" /> 選擇檔案
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">快速入口</p>
                    <div className="flex flex-wrap gap-1">
                      <a href="/products" className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">商品作戰室</a>
                      <a href="/" className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">今日決策中心</a>
                      <a href="/assets" className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">素材生命週期</a>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>
        )}

        <main className="flex-1 flex flex-col min-w-0 bg-gray-50">
          {loadingSession && sessionIdFromUrl ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 bg-gray-50">
                <div className="max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
                  <section className="space-y-3" data-testid="section-decision-cards">
                    <h2 className="text-sm font-semibold text-gray-700">RICH BEAR 審判官決策卡（規則引擎產出）</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {decisionCards.length === 0 ? (
                        <Card className="bg-white border border-gray-200 col-span-full">
                          <CardContent className="p-4 text-sm text-gray-600">
                            載入中或尚無廣告資料，請先同步廣告資料後重新整理。
                          </CardContent>
                        </Card>
                      ) : (
                        decisionCards.map((block) => (
                          <Card key={block.key} className="bg-white border border-gray-200">
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-xs font-semibold text-muted-foreground">{block.label}</p>
                                <span className="text-[10px] text-muted-foreground">
                                  {block.confidence === "high" ? "高" : block.confidence === "medium" ? "中" : block.confidence === "data_insufficient" ? "資料不足" : "低"}
                                </span>
                                {block.copyableText && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => {
                                      navigator.clipboard.writeText(block.copyableText!);
                                      toast({ title: "已複製到剪貼簿", duration: 2000 });
                                    }}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm font-medium whitespace-pre-wrap">{block.conclusion}</p>
                              <div className="text-xs space-y-1 border-t pt-2 text-muted-foreground">
                                <p><span className="font-medium">觸發規則：</span>{block.triggerRule}</p>
                                <p><span className="font-medium">證據指標：</span>{block.evidenceMetrics}</p>
                                <p><span className="font-medium">建議動作：</span>{block.suggestedAction}</p>
                                <p><span className="font-medium">影響金額：</span>{block.impactAmount}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </section>

                  {messages.length === 0 && !isSubmitting && (
                    <div className="py-8">
                      <p className="text-lg font-semibold text-center text-gray-900 mb-1">裁決入口 — 拿判決，不是純聊天</p>
                      <p className="text-sm text-center text-gray-600 mb-4">選擇審判類型或輸入你的問題，總監會給出可執行的裁決與建議</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                        {EMPTY_ENTRIES.map((e) => (
                          <Card
                            key={e.id}
                            className="cursor-pointer hover:bg-muted/60 transition-colors"
                            onClick={() => {
                              setWorkflow(e.workflow);
                              setUiMode(e.mode);
                              if (e.prompt) handleQuickPrompt(e.prompt);
                            }}
                          >
                            <CardContent className="p-4 flex items-center gap-3">
                              <span className="text-2xl">{e.icon}</span>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm">{e.label}</p>
                                <p className="text-xs text-muted-foreground">{e.short}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      <p className="text-xs text-center text-muted-foreground mt-4">可貼網址、上傳圖片／影片／PDF，總監會一併參考。</p>
                    </div>
                  )}
                  {messages.map((msg) =>
                    msg.role === "user" ? (
                      <UserBubble key={msg.id} message={msg} />
                    ) : (
                      <JudgmentWorkbenchBubble
                        key={msg.id}
                        message={msg}
                        judgmentContext={{
                          sessionId: session?.id ?? null,
                          productName: urlContext.productName,
                          creativeId: urlContext.creativeId,
                          impactAmount: urlContext.impactAmount,
                        }}
                        onCreateTask={handleCreateTaskFromJudgment}
                        onExportReport={handleExportSingleReport}
                        auditBlockId={`audit-${msg.id}`}
                      />
                    ),
                  )}
                  {isSubmitting && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white shadow-sm border border-gray-200 px-4 py-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                        <span className="text-sm text-gray-700">總監審視中…</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {rightPanelOpen && (
                <aside className="w-72 border-l border-gray-200 bg-white shrink-0 flex flex-col no-print">
                  <div className="p-3 border-b">
                    <p className="text-xs font-semibold text-gray-700">證據與指標</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Meta · GA4 · ROI 漏斗 · 任務</p>
                  </div>
                  <div className="flex-1 p-3 overflow-auto text-sm">
                    <AccountExceptionsBlock scopeAccountIds={scope.selectedAccountIds} compact />
                    <p className="text-xs font-medium text-gray-600 mt-4 mb-2">本次上傳的素材與指標</p>
                    {attachments.length > 0 ? (
                      <div className="space-y-2">
                        {attachments.map((a) => (
                          <div key={a.id} className="rounded-lg border border-gray-200 p-2 text-xs">
                            {a.preview && <img src={a.preview} alt="" className="w-full rounded mb-1 max-h-24 object-cover" />}
                            <span className="truncate block text-gray-700">{a.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">尚無附加檔案</p>
                    )}
                  </div>
                </aside>
              )}

              <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 no-print">
                <div className="max-w-4xl mx-auto flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground shrink-0">工作流：</span>
                    {(Object.keys(workflowLabels) as Workflow[]).map((w) => (
                      <Button
                        key={w}
                        type="button"
                        variant={workflow === w ? "default" : "outline"}
                        size="sm"
                        className="shrink-0 rounded-full text-xs h-7"
                        onClick={() => setWorkflow(w)}
                        data-testid={`workflow-${w}`}
                      >
                        {workflowLabels[w]}
                      </Button>
                    ))}
                    <Badge variant="secondary" className="text-[10px] shrink-0">目前：{workflowLabels[workflow]}</Badge>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    {QUICK_PROMPTS.map((q) => (
                      <Button
                        key={q.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-full text-xs gap-1"
                        onClick={() => handleQuickPrompt(q.text)}
                        data-testid={`quick-prompt-${q.id}`}
                      >
                        <span>{q.icon}</span>
                        {q.label}
                      </Button>
                    ))}
                  </div>
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm"
                          data-testid={`attachment-${a.id}`}
                        >
                          {a.preview ? (
                            <img src={a.preview} alt="" className="w-10 h-10 object-cover rounded" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="max-w-[120px] truncate">{a.name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(a.id)}
                            className="p-0.5 rounded hover:bg-muted"
                            data-testid={`remove-attach-${a.id}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {submitError && (
                    <div className="flex items-center gap-2 text-sm text-destructive" data-testid="alert-submit-error">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    <Textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="輸入訊息或貼上網址、文案… (Enter 送出、Shift+Enter 換行)"
                      rows={1}
                      className="min-h-[44px] max-h-[200px] resize-y"
                      data-testid="textarea-chat-input"
                      disabled={isSubmitting}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPT_ATTACH}
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) addFiles(e.target.files);
                        e.target.value = "";
                      }}
                      data-testid="input-file-attach"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      title="附加圖片、PDF 或影片"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      data-testid="button-attach"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSend}
                      disabled={!canSubmit}
                      className="shrink-0 gap-1.5"
                      data-testid="button-send-judgment"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      送出
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    支援圖片、PDF、影片 (最高 200MB)；可貼網址，總監會參考頁面內容。判讀依「Prompt 設定」該模式已發布主 prompt ＋ 系統校準。
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
