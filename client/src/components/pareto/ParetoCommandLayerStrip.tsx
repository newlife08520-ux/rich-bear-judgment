import { useQuery } from "@tanstack/react-query";
import { useAppScope } from "@/hooks/use-app-scope";
import { useAuth } from "@/lib/auth";

/** 與首頁／商品等同源之營運摘要（僅顯示少做／多做結論） */
export function ParetoCommandLayerStrip() {
  const { user } = useAuth();
  const scope = useAppScope();
  const params = new URLSearchParams();
  if (scope.scopeKey) params.set("scope", scope.scopeKey);
  if (scope.selectedAccountIds?.length) params.set("scopeAccountIds", scope.selectedAccountIds.join(","));
  const q = params.toString();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pareto/command-layer", q, user?.role ?? ""],
    queryFn: async () => {
      const url = q ? `/api/pareto/command-layer?${q}` : "/api/pareto/command-layer";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("command-layer");
      return (await res.json()) as {
        doLess?: { expensiveMistakesToReduce?: string[] };
        doMore?: { expandCandidates?: string[] };
      };
    },
  });

  if (isLoading) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="pareto-command-layer-strip-loading">
        載入建議中…
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
      <p>
        <span className="text-foreground font-medium">少做：</span>
        {mistake}
      </p>
      <p>
        <span className="text-foreground font-medium">多做：</span>
        {opp}
      </p>
    </div>
  );
}
