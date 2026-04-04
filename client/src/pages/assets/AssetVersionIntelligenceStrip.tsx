import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ReviewRow = {
  id: string;
  reviewStatus: string;
  summary?: string | null;
  nextAction?: string | null;
  problemType?: string | null;
  score?: number | null;
};

type HistoryRow = {
  id: string;
  createdAt: string;
  reviewStatus: string;
  summary?: string | null;
  nextAction?: string | null;
  score?: number | null;
  problemType?: string | null;
};

type JobPayload = { job: { id: string; status: string; lastError?: string | null } };

export function AssetVersionIntelligenceStrip({ assetVersionId }: { assetVersionId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [reviewJobFailedMessage, setReviewJobFailedMessage] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creative-reviews/by-version", assetVersionId],
    queryFn: async () => {
      const res = await fetch(`/api/creative-reviews/by-version/${encodeURIComponent(assetVersionId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        return { review: null as ReviewRow | null, tags: [] as { tagType: string; tagValue: string }[], totalReviewCount: 0 };
      }
      return res.json() as Promise<{
        review: ReviewRow | null;
        tags: { tagType: string; tagValue: string }[];
        totalReviewCount?: number;
      }>;
    },
  });
  const review = data?.review ?? null;
  const tags = data?.tags ?? [];
  const totalReviewCount =
    typeof data?.totalReviewCount === "number" ? data.totalReviewCount : review ? 1 : 0;

  const historyQuery = useQuery({
    queryKey: ["/api/creative-reviews/by-version/history", assetVersionId],
    enabled: historyOpen && totalReviewCount > 1,
    queryFn: async () => {
      const res = await fetch(
        `/api/creative-reviews/by-version/${encodeURIComponent(assetVersionId)}/history`,
        { credentials: "include" }
      );
      if (!res.ok) return { items: [] as HistoryRow[] };
      return res.json() as Promise<{ items: HistoryRow[] }>;
    },
  });

  const jobQuery = useQuery({
    queryKey: ["/api/creative-reviews/jobs", activeJobId],
    enabled: Boolean(activeJobId),
    queryFn: async () => {
      const res = await fetch(`/api/creative-reviews/jobs/${encodeURIComponent(activeJobId!)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("無法讀取審判工作狀態");
      return (await res.json()) as JobPayload;
    },
    refetchInterval: (q) => {
      const st = (q.state.data as JobPayload | undefined)?.job?.status;
      return st === "pending" || st === "running" ? 2200 : false;
    },
  });

  useEffect(() => {
    const st = jobQuery.data?.job?.status;
    if (!st || !activeJobId) return;
    if (st === "failed") {
      setReviewJobFailedMessage(jobQuery.data?.job?.lastError ?? "AI 服務暫時無法回應");
      setActiveJobId(null);
      return;
    }
    if (st === "completed") {
      void qc.invalidateQueries({ queryKey: ["/api/creative-reviews/by-version", assetVersionId] });
      setActiveJobId(null);
    }
  }, [jobQuery.data?.job?.status, jobQuery.data?.job?.lastError, activeJobId, assetVersionId, qc]);

  const queueReview = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/creative-reviews/queue", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetVersionId, reviewSource: review ? "rejudge" : "manual_judgment" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) {
        throw new Error((j as { message?: string }).message ?? "排程失敗");
      }
      return j as { jobId?: string };
    },
    onSuccess: (body) => {
      setReviewJobFailedMessage(null);
      const id = typeof body.jobId === "string" ? body.jobId : "";
      if (id) setActiveJobId(id);
      toast({ title: "已排入審判佇列", description: "背景處理中，無需等待此請求完成" });
    },
    onError: (e: Error) => toast({ title: "排程失敗", description: e.message, variant: "destructive" }),
  });

  const retryReview = () => {
    setReviewJobFailedMessage(null);
    queueReview.mutate();
  };

  const jobStatus = jobQuery.data?.job?.status;
  const processing =
    Boolean(activeJobId) && jobStatus !== "completed" && jobStatus !== "failed";

  if (isLoading) {
    return (
      <p className="text-xs text-muted-foreground mt-1" data-testid="asset-version-intelligence">
        Intelligence 載入中…
      </p>
    );
  }
  if (!review) {
    return (
      <div className="mt-1 flex flex-col gap-1" data-testid="asset-version-intelligence">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">尚未送審</span>
          {processing && (
            <span className="text-xs text-primary flex items-center gap-0.5">
              <Loader2 className="w-3 h-3 animate-spin" /> 佇列處理中…
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            disabled={queueReview.isPending || processing}
            onClick={() => queueReview.mutate()}
          >
            {queueReview.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "送審（佇列）"}
          </Button>
        </div>
        {reviewJobFailedMessage && (
          <div className="rounded border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive flex flex-wrap items-center gap-2">
            <span>審查失敗：{reviewJobFailedMessage}</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 shrink-0" onClick={retryReview}>
              重試
            </Button>
          </div>
        )}
      </div>
    );
  }

  const hookPain = tags.filter((t) => ["hook", "pain", "proof", "format"].includes(t.tagType));
  const historyItems = historyQuery.data?.items ?? [];

  return (
    <div className="mt-1 space-y-1 border-t border-border/60 pt-1" data-testid="asset-version-intelligence">
      {processing && (
        <p className="text-xs text-primary flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> 重新審判佇列處理中…
        </p>
      )}
      {reviewJobFailedMessage && (
        <div className="rounded border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive flex flex-wrap items-center gap-2">
          <span>審查失敗：{reviewJobFailedMessage}</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 shrink-0" onClick={retryReview}>
            重試
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-1 items-center">
        <Badge variant="secondary" className="text-xs font-normal">
          {review.reviewStatus === "completed" ? "已審判" : review.reviewStatus}
        </Badge>
        {review.score != null && <span className="text-xs text-muted-foreground">分 {review.score}</span>}
      </div>
      {review.summary && <p className="text-xs line-clamp-2 text-foreground">{review.summary}</p>}
      {review.problemType && (
        <p className="text-xs text-muted-foreground">問題類型：{review.problemType}</p>
      )}
      {review.nextAction && (
        <p className="text-xs text-muted-foreground">下一步：{review.nextAction}</p>
      )}
      {hookPain.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {hookPain.slice(0, 6).map((t) => (
            <Badge key={`${t.tagType}-${t.tagValue}`} variant="outline" className="text-[11px] font-normal px-1 py-0">
              {t.tagType}:{t.tagValue}
            </Badge>
          ))}
        </div>
      )}
      {totalReviewCount > 1 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform", historyOpen && "rotate-180")} />
              查看歷史審查（{totalReviewCount - 1} 次較早紀錄）
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-1 pl-1 border-l border-border/60">
            {historyQuery.isLoading && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> 載入歷史…
              </p>
            )}
            {historyItems.map((h) => (
              <div key={h.id} className="text-xs text-muted-foreground space-y-0.5">
                <div className="font-medium text-foreground/80">
                  {new Date(h.createdAt).toLocaleString()} · {h.reviewStatus}
                  {h.score != null ? ` · 分 ${h.score}` : ""}
                </div>
                {h.summary && <p className="line-clamp-2">{h.summary}</p>}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 text-xs px-1"
        disabled={queueReview.isPending || processing}
        onClick={() => queueReview.mutate()}
      >
        {queueReview.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "重新送審（佇列）"}
      </Button>
    </div>
  );
}
