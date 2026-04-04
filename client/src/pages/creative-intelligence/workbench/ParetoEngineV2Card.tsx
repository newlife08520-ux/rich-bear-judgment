import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type EngineV2 = {
  engineVersion?: string;
  legacyPrecedenceNote?: string;
  scopes?: { level: string; key: string; label: string; items: { id: string }[] }[];
  dominantWinningHooks?: string[];
  dominantFailurePatterns?: string[];
  canonicalWorkbench?: {
    topRevenueContributors?: { label: string }[];
    moneyPits?: { label: string }[];
    hiddenDiamonds?: { label: string }[];
  };
};

export function ParetoEngineV2Card(props: { engineV2: EngineV2 | undefined }) {
  const e = props.engineV2;
  if (!e) return null;
  const scopes = e.scopes ?? [];
  return (
    <Card data-testid="ci-pareto-engine-v2">
      <CardHeader>
        <CardTitle className="text-base">80／20 跨層級摘要</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-2">
        <p>
          分析範圍：
          {scopes.map((s) => `${s.label || s.level}（${s.items?.length ?? 0}）`).join(" · ") || "—"}
        </p>
        <p>主導贏家方向：{(e.dominantWinningHooks ?? []).slice(0, 6).join("、") || "—"}</p>
        <p>主導落後型態：{(e.dominantFailurePatterns ?? []).slice(0, 6).join("、") || "—"}</p>
        <p className="text-foreground/80">
          貢獻前列：
          {(e.canonicalWorkbench?.topRevenueContributors ?? []).slice(0, 4).map((x) => x.label).join("、") || "—"}
        </p>
      </CardContent>
    </Card>
  );
}
