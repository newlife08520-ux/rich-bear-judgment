import { useQuery } from "@tanstack/react-query";
import { useAppScope } from "@/hooks/use-app-scope";

/** 7.6：與 Dashboard／CI 同源之 command layer（供商品／FB 等頁共用） */
export function ParetoCommandLayerStrip() {
  const scope = useAppScope();
  const params = new URLSearchParams();
  if (scope.scopeKey) params.set("scope", scope.scopeKey);
  if (scope.selectedAccountIds?.length) params.set("scopeAccountIds", scope.selectedAccountIds.join(","));
  const q = params.toString();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pareto/command-layer", q],
    queryFn: async () => {
      const url = q ? `/api/pareto/command-layer?${q}` : "/api/pareto/command-layer";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("command-layer");
      return (await res.json()) as {
        version?: string;
        doLess?: { expensiveMistakesToReduce?: string[] };
        doMore?: { expandCandidates?: string[] };
        legacyVsEngine?: { note?: string };
      };
    },
  });

  if (isLoading) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="pareto-command-layer-strip-loading">
        Pareto command layer 載入中…
      </p>
    );
  }
  if (!data) return null;

  const mistake = data.doLess?.expensiveMistakesToReduce?.[0] ?? "—";
  const opp = data.doMore?.expandCandidates?.[0] ?? "—";

  return (
    <div
      className="text-xs text-muted-foreground border rounded-md p-2 space-y-1 bg-muted/30"
      data-testid="pareto-command-layer-strip"
    >
      <p className="font-medium text-foreground">Pareto 營運指令層（{data.version ?? "v4"}）</p>
      <p>
        <span className="text-foreground">少做：</span>
        {mistake}
      </p>
      <p>
        <span className="text-foreground">多做：</span>
        {opp}
      </p>
      {data.legacyVsEngine?.note ? (
        <p className="text-[10px] leading-snug opacity-80">{data.legacyVsEngine.note}</p>
      ) : null}
    </div>
  );
}
