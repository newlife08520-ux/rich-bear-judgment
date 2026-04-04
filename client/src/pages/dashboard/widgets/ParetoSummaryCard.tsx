import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAppScope } from "@/hooks/use-app-scope";
import { Link } from "wouter";

/** 決策中心：商品維度 80／20 摘要 */
export function ParetoSummaryCard() {
  const scope = useAppScope();
  const params = new URLSearchParams();
  if (scope.scopeKey) params.set("scope", scope.scopeKey);
  if (scope.selectedAccountIds?.length) params.set("scopeAccountIds", scope.selectedAccountIds.join(","));
  const q = params.toString();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pareto/by-product", q],
    queryFn: async () => {
      const url = q ? `/api/pareto/by-product?${q}` : "/api/pareto/by-product";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("pareto");
      return (await res.json()) as {
        productCount: number;
        workbench?: {
          topRevenueContributors: { label: string; reason: string }[];
          moneyPits: { label: string; reason: string }[];
        };
        engineV2?: {
          canonicalWorkbench?: {
            topRevenueContributors: { label: string; reason: string }[];
            moneyPits: { label: string; reason: string }[];
          };
          legacyPrecedenceNote?: string;
        };
      };
    },
  });

  const { data: cmd } = useQuery({
    queryKey: ["/api/pareto/command-layer", q],
    queryFn: async () => {
      const url = q ? `/api/pareto/command-layer?${q}` : "/api/pareto/command-layer";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("command-layer");
      return (await res.json()) as {
        doLess?: { expensiveMistakesToReduce?: string[] };
        doMore?: { expandCandidates?: string[] };
        legacyVsEngine?: { whenLegacyViewDiffers?: string };
      };
    },
  });

  return (
    <Card data-testid="dashboard-pareto-summary" className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-base">80／20 摘要（商品）</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        {isLoading && (
          <p className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 計算中…
          </p>
        )}
        {data && (
          <>
            <p>商品數：{data.productCount}</p>
            <div className="text-xs space-y-1">
              <p className="font-medium text-foreground">貢獻前段</p>
              {(
                data.engineV2?.canonicalWorkbench?.topRevenueContributors ??
                data.workbench?.topRevenueContributors ??
                []
              )
                .slice(0, 3)
                .map((x) => (
                <p key={x.label} className="line-clamp-2">
                  {x.label} — {x.reason}
                </p>
              ))}
            </div>
            <div className="text-xs space-y-1">
              <p className="font-medium text-foreground">壓力尾段（摘 · v2 canonical）</p>
              {(data.engineV2?.canonicalWorkbench?.moneyPits ?? data.workbench?.moneyPits ?? []).slice(0, 2).map((x) => (
                <p key={x.label} className="line-clamp-2">
                  {x.label} — {x.reason}
                </p>
              ))}
            </div>
            {cmd ? (
              <div className="text-xs space-y-1 border-t pt-2 mt-2" data-testid="dashboard-pareto-command-layer">
                <p className="font-medium text-foreground">建議（少做／多做）</p>
                <p>少做：{cmd.doLess?.expensiveMistakesToReduce?.[0] ?? "—"}</p>
                <p>多做：{cmd.doMore?.expandCandidates?.[0] ?? "—"}</p>
              </div>
            ) : null}
            <Link href="/creative-intelligence" className="text-xs text-primary underline">
              至創意智慧看完整分析
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
