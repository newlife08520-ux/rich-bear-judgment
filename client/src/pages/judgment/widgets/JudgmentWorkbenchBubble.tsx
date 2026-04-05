import { useState } from "react";
import { useLocation } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, ListTodo, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage } from "@shared/schema";
import type { JudgmentContext, ParsedJudgment, TaskCreateFromJudgmentPayload } from "../judgment-types";
import { cn } from "@/lib/utils";
import { DEFAULT_REVIEW_THRESHOLD, PROBLEM_TYPE_BADGES, CONFIDENCE_LABELS } from "../judgment-types";
import { getParsedForMessage, buildTaskPayloadFromParsed } from "../judgment-formatters";
import { ScoreBar } from "@/components/shared/ScoreBar";

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

export function JudgmentWorkbenchBubble({
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
  const [, setLocation] = useLocation();
  const ctx = judgmentContext ?? { sessionId: null, productName: null, creativeId: null, impactAmount: null };
  const parsed = getParsedForMessage(message);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const hasEvidence = parsed.evidence.trim().length > 0;
  const evidencePreview = parsed.evidence.trim().slice(0, 80) + (parsed.evidence.length > 80 ? "…" : "");
  const hasScore = typeof parsed.score === "number";
  const passed = hasScore && parsed.score! >= DEFAULT_REVIEW_THRESHOLD;

  const detailMdParts: string[] = [];
  if (parsed.reason?.trim()) detailMdParts.push(`### 詳細原因\n\n${parsed.reason.trim()}`);
  if (parsed.suggestions?.trim()) detailMdParts.push(`### 具體建議\n\n${parsed.suggestions.trim()}`);
  const fallbackBody =
    !parsed.verdict?.trim() && !parsed.reason?.trim() && !parsed.suggestions?.trim() ? message.content.trim() : "";
  const detailMarkdown = fallbackBody || detailMdParts.join("\n\n");
  const hasDetailMarkdown = detailMarkdown.length > 0;

  const structuredRec = (
    message.structuredJudgment as { recommendation?: string } | undefined
  )?.recommendation?.toLowerCase?.() ?? "";
  const showPublishDraftCta =
    structuredRec === "launch" ||
    structuredRec === "scale" ||
    /放量|擴量|加碼|上架投放|開啟投放|launch|scale/i.test(
      `${parsed.verdict} ${parsed.actionFirst} ${parsed.suggestions ?? ""}`
    );

  return (
    <div className="flex justify-start w-full max-w-4xl">
      <div className="w-full space-y-3">
        <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
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
              {showPublishDraftCta && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setLocation("/publish")}
                  data-testid="button-judgment-to-publish-draft"
                >
                  建立投放草稿 →
                </Button>
              )}
              {auditBlockId
                ? hasScore
                  ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => document.getElementById(auditBlockId)?.scrollIntoView({ behavior: "smooth" })}
                    >
                      審核結果
                    </Button>
                  )
                  : (
                    <span className="text-xs text-muted-foreground px-2 py-1.5" title="本則無評分">
                      審核結果（本則無評分）
                    </span>
                  )
                : null}
            </div>
            {hasScore ? (
              <div className="space-y-2">
                <ScoreBar score={parsed.score!} />
                <p className="text-xs text-muted-foreground">
                  門檻 {DEFAULT_REVIEW_THRESHOLD} 分 · {passed ? "通過" : "未通過"}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">一句總判決</p>
                <p className="text-sm font-semibold text-foreground leading-snug">
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
                  <Badge className="text-xs bg-indigo-50 text-indigo-800 border-indigo-200 border dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800/50">
                    建議產任務
                  </Badge>
                )}
              </div>
            </div>
            {parsed.actionFirst && (
              <div className="border-t border-border/60 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">先做什麼</p>
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{parsed.actionFirst}</div>
              </div>
            )}
            {hasScore && (
              <div
                id={auditBlockId}
                className="border-t border-border pt-3 space-y-2 rounded-md bg-muted/40 p-3"
              >
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">審核結果</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">綜合分數</span>
                  <span className="font-medium">{parsed.score}</span>
                  <span className="text-muted-foreground">門檻分數</span>
                  <span className="font-medium">{DEFAULT_REVIEW_THRESHOLD}</span>
                  <span className="text-muted-foreground">結果</span>
                  <span className={passed ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
                    {passed ? "通過" : "未通過"}
                  </span>
                </div>
                {parsed.blockingReasons?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">阻擋原因</p>
                    <ul className="list-disc list-inside text-sm text-foreground space-y-0.5">
                      {parsed.blockingReasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {parsed.pendingItems?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">待辦／待補</p>
                    <ul className="list-disc list-inside text-sm text-foreground space-y-0.5">
                      {parsed.pendingItems.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
            {hasDetailMarkdown && (parsed.reason?.trim() || parsed.suggestions?.trim() || fallbackBody) ? (
              <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between px-0 text-muted-foreground">
                    <span>查看完整分析</span>
                    {detailOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div
                    className="prose prose-neutral dark:prose-invert max-w-none prose-sm text-foreground prose-p:my-1 prose-ul:my-1 prose-ol:my-1 pt-2 border-t border-border/60"
                    data-print-content={message.id}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailMarkdown}</ReactMarkdown>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </CardContent>
        </Card>
        {!parsed.verdict && !parsed.reason && !parsed.suggestions && (
          <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div
                className="prose prose-neutral dark:prose-invert max-w-none prose-sm text-foreground prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
                data-print-content={message.id}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}
        {hasEvidence && (
          <Collapsible open={evidenceOpen} onOpenChange={setEvidenceOpen}>
            <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
              <CollapsibleTrigger asChild>
                <button className="w-full p-4 flex items-center justify-between gap-2 text-left hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">證據與指標</span>
                    <span className="text-xs text-muted-foreground">{evidencePreview}</span>
                  </div>
                  {evidenceOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 border-t border-border/60">
                  <div className="prose prose-neutral dark:prose-invert max-w-none prose-sm text-muted-foreground prose-p:my-1 prose-table:my-2 mt-3">
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
