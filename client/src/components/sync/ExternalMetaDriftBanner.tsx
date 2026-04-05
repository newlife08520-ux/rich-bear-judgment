import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

type HintsResponse = {
  hints: { campaignId: string; message: string; reasons: string[] }[];
  tokenMissing?: boolean;
  graphError?: string;
};

export function ExternalMetaDriftBanner(props: { surface: string }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery<HintsResponse>({
    queryKey: ["/api/sync/out-of-band-hints", props.surface],
    queryFn: async () => {
      const res = await fetch("/api/sync/out-of-band-hints", { credentials: "include" });
      if (!res.ok) return { hints: [] };
      return res.json();
    },
    staleTime: 60_000,
  });

  const ack = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sync/acknowledge-external-drift", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error("ack failed");
      return res.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["/api/sync/out-of-band-hints"] });
    },
  });

  if (isLoading || !data) return null;
  if (data.tokenMissing) return null;
  const hints = data.hints ?? [];
  if (hints.length === 0 && !data.graphError) return null;

  return (
    <Alert
      variant="default"
      className="border-slate-200 bg-white border-l-4 border-l-amber-500 mx-4 md:mx-6 mt-2 dark:border-border dark:bg-card"
      data-testid="external-meta-drift-banner"
      data-surface={props.surface}
    >
      <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
      <AlertTitle className="text-amber-950 dark:text-amber-100">
        原生後台可能已變更投放設定
      </AlertTitle>
      <AlertDescription className="text-sm space-y-2 text-amber-950/90 dark:text-amber-50/90">
        {data.graphError && <p className="text-xs opacity-90">{data.graphError}</p>}
        {hints.length > 0 && (
          <ul className="list-disc pl-4 space-y-1">
            {hints.slice(0, 5).map((h) => (
              <li key={h.campaignId}>
                <span className="font-mono text-xs">{h.campaignId}</span>：{h.message}
                {h.reasons?.length ? (
                  <span className="block text-xs opacity-80 mt-0.5">{h.reasons.join("；")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-amber-700/40"
            onClick={() => void refetch()}
            disabled={isFetching}
            data-testid="external-drift-recheck"
          >
            <RefreshCw className={isFetching ? "w-3 h-3 mr-1 animate-spin" : "w-3 h-3 mr-1"} />
            重新檢查
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => ack.mutate()}
            disabled={ack.isPending}
            data-testid="external-drift-ack-adjust-reset"
          >
            已讀並校準今日調整節奏
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
