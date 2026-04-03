import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FamMap = Record<
  string,
  { winners: { key: string; count: number }[]; losers: { key: string; count: number }[] }
>;

export function TagFamilyWorkbenchPanel(props: {
  tagFamilies: FamMap | undefined;
  tagFamilyOrder: string[] | undefined;
}) {
  const order = props.tagFamilyOrder ?? Object.keys(props.tagFamilies ?? {});
  const fam = props.tagFamilies ?? {};
  return (
    <Card data-testid="ci-tag-families">
      <CardHeader>
        <CardTitle className="text-base">標籤家族（hook／pain／proof／CTA／format／angle／scene…）</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-4">
        {order.map((family) => {
          const block = fam[family];
          if (!block) return null;
          return (
            <div key={family} className="border-b border-border/60 pb-3 last:border-0">
              <p className="font-medium capitalize mb-1">{family}</p>
              <div className="grid md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="text-foreground/80">贏家側</span>
                  {block.winners.length === 0 ? (
                    <p>—</p>
                  ) : (
                    <ul className="list-disc pl-4">
                      {block.winners.map((w) => (
                        <li key={w.key}>
                          {w.key}：{w.count}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <span className="text-foreground/80">落後側</span>
                  {block.losers.length === 0 ? (
                    <p>—</p>
                  ) : (
                    <ul className="list-disc pl-4">
                      {block.losers.map((w) => (
                        <li key={w.key}>
                          {w.key}：{w.count}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
