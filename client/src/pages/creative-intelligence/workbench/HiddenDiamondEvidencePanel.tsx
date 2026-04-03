import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HiddenDiamondEvidencePanel(props: {
  items:
    | {
        assetVersionId: string;
        roas: number;
        spend: number;
        lifecycleLabel?: string | null;
        ambiguousAttribution?: boolean;
        evidenceSnippet?: string;
      }[]
    | undefined;
}) {
  const items = props.items ?? [];
  return (
    <Card data-testid="ci-hidden-evidence">
      <CardHeader>
        <CardTitle className="text-base">Hidden diamonds（含 evidence 摘要）</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2 text-muted-foreground">
        {items.length === 0 ? (
          <p>目前無符合條件之版本（或皆為歧義歸因）。</p>
        ) : (
          items.slice(0, 12).map((x) => (
            <div key={x.assetVersionId} className="border border-border/50 rounded p-2">
              <p className="text-foreground font-mono text-[11px]">{x.assetVersionId}</p>
              <p>
                ROAS {x.roas.toFixed(2)} · 花費 {x.spend.toFixed(0)} · {x.lifecycleLabel ?? "—"} · ambiguous=
                {String(x.ambiguousAttribution ?? false)}
              </p>
              {x.evidenceSnippet ? <p className="mt-1 opacity-90">{x.evidenceSnippet}</p> : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
