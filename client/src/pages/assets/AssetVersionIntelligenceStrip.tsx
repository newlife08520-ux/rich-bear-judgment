import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ReviewRow = {
  id: string;
  reviewStatus: string;
  summary?: string | null;
  nextAction?: string | null;
  problemType?: string | null;
  score?: number | null;
};

type JobPayload = { job: { id: string; status: string; errorMessage?: string | null } };

export function AssetVersionIntelligenceStrip({ assetVersionId }: { assetVersionId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creative-reviews/by-version", assetVersionId],
    queryFn: async () => {
      const res = await fetch(`/api/creative-reviews/by-version/${encodeURIComponent(assetVersionId)}`, {
        credentials: "include",
      });
      if (!res.ok) return { review: null as ReviewRow | null, tags: [] as { tagType: string; tagValue: string }[] };
      return res.json();
    },
  });
  const review = data?.review as ReviewRow | null;
  const tags = (data?.tags ?? []) as { tagType: string; tagValue: string }[];

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
      toast({
        title: "審判失敗",
        description: jobQuery.data?.job?.errorMessage ?? "請稍後重試",
        variant: "destructive",
      });
      setActiveJobId(null);
      return;
    }
    if (st === "completed") {
      void qc.invalidateQueries({ queryKey: ["/api/creative-reviews/by-version", assetVersionId] });
      setActiveJobId(null);
    }
  }, [jobQuery.data?.job?.status, jobQuery.data?.job?.errorMessage, activeJobId, assetVersionId, qc, toast]);

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
      const id = typeof body.jobId === "string" ? body.jobId : "";
      if (id) setActiveJobId(id);
      toast({ title: "已排入審判佇列", description: "背景處理中，無需等待此請求完成" });
    },
    onError: (e: Error) => toast({ title: "排程失敗", description: e.message, variant: "destructive" }),
  });

  const jobStatus = jobQuery.data?.job?.status;
  const processing =
    Boolean(activeJobId) && jobStatus !== "completed" && jobStatus !== "failed";

  if (isLoading) {
    return (
      <p className="text-[10px] text-muted-foreground mt-1" data-testid="asset-version-intelligence">
        Intelligence 載入中…
      </p>
    );
  }
  if (!review) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1" data-testid="asset-version-intelligence">
        <span className="text-[10px] text-muted-foreground">尚未送審</span>
        {processing && (
          <span className="text-[10px] text-primary flex items-center gap-0.5">
            <Loader2 className="w-3 h-3 animate-spin" /> 佇列處理中…
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 text-[10px] px-2"
          disabled={queueReview.isPending || processing}
          onClick={() => queueReview.mutate()}
        >
          {queueReview.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "送審（佇列）"}
        </Button>
      </div>
    );
  }

  const hookPain = tags.filter((t) => ["hook", "pain", "proof", "format"].includes(t.tagType));
  return (
    <div className="mt-1 space-y-1 border-t border-border/60 pt-1" data-testid="asset-version-intelligence">
      {processing && (
        <p className="text-[10px] text-primary flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> 重新審判佇列處理中…
        </p>
      )}
      <div className="flex flex-wrap gap-1 items-center">
        <Badge variant="secondary" className="text-[10px] font-normal">
          {review.reviewStatus === "completed" ? "已審判" : review.reviewStatus}
        </Badge>
        {review.score != null && <span className="text-[10px] text-muted-foreground">分 {review.score}</span>}
      </div>
      {review.summary && <p className="text-[10px] line-clamp-2 text-foreground">{review.summary}</p>}
      {review.problemType && (
        <p className="text-[10px] text-muted-foreground">問題類型：{review.problemType}</p>
      )}
      {review.nextAction && (
        <p className="text-[10px] text-muted-foreground">下一步：{review.nextAction}</p>
      )}
      {hookPain.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {hookPain.slice(0, 6).map((t) => (
            <Badge key={`${t.tagType}-${t.tagValue}`} variant="outline" className="text-[9px] font-normal px-1 py-0">
              {t.tagType}:{t.tagValue}
            </Badge>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] px-1"
        disabled={queueReview.isPending || processing}
        onClick={() => queueReview.mutate()}
      >
        {queueReview.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "重新送審（佇列）"}
      </Button>
    </div>
  );
}
