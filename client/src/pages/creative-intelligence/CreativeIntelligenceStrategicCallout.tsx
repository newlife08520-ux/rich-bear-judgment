/**
 * CI 頁頂層「可行動」摘要：贏／輸 motif、信心與歧義，不把整頁變成純統計板。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Skull, Gem } from "lucide-react";

type PatternsPayload = {
  hookTopWinners?: { tag: string; count: number }[];
  hookTopLosers?: { tag: string; count: number }[];
  snapshotCount?: number;
  ambiguousSnapshotCount?: number;
  reviewCount?: number;
  hiddenDiamondEvidence?: unknown[];
  degraded?: boolean;
  degradedReason?: string;
};

export function CreativeIntelligenceStrategicCallout({ patterns }: { patterns: PatternsPayload }) {
  const winners = patterns.hookTopWinners ?? [];
  const losers = patterns.hookTopLosers ?? [];
  const snaps = patterns.snapshotCount ?? 0;
  const amb = patterns.ambiguousSnapshotCount ?? 0;
  const ambRatio = snaps > 0 ? amb / snaps : 0;
  const diamonds = patterns.hiddenDiamondEvidence?.length ?? 0;

  return (
    <Card className="border-violet-200/60 dark:border-violet-900/50 bg-violet-50/20 dark:bg-violet-950/10" data-testid="ci-strategic-callout">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          可執行結論（模式層）
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal leading-relaxed">
          高樣本、低歧義之 hook 較適合當「加碼方向」；落後 motif 搭配活動／商品節奏檢視，勿單憑標籤關廣告。歧義快照比例高時，整頁模式降權。
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
        <div className="rounded-lg border border-border/60 bg-background/80 p-3">
          <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            較常與贏家共現（Top）
          </h3>
          {winners.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {winners.slice(0, 5).map((x) => (
                <li key={x.tag}>
                  <span className="font-mono text-[11px]">{x.tag}</span> ×{x.count}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">尚無足夠樣本</p>
          )}
        </div>
        <div className="rounded-lg border border-border/60 bg-background/80 p-3">
          <h3 className="text-xs font-semibold text-red-800 dark:text-red-300 flex items-center gap-1 mb-2">
            <Skull className="w-3.5 h-3.5" />
            較常與落後共現（Top）
          </h3>
          {losers.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {losers.slice(0, 5).map((x) => (
                <li key={x.tag}>
                  <span className="font-mono text-[11px]">{x.tag}</span> ×{x.count}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">尚無足夠樣本</p>
          )}
        </div>
        <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-2 text-xs">
          <h3 className="text-xs font-semibold flex items-center gap-1">
            <Gem className="w-3.5 h-3.5" />
            信心與隱藏鑽石
          </h3>
          <p>
            快照 {snaps} · 歧義 {amb}
            {snaps > 0 ? `（${(ambRatio * 100).toFixed(0)}%）` : ""}
          </p>
          <p>審判筆數 {patterns.reviewCount ?? 0}</p>
          <p>隱藏鑽石證據列 {diamonds} 筆</p>
          {ambRatio >= 0.25 && snaps >= 5 && (
            <p className="text-amber-800 dark:text-amber-200 font-medium">歧義比例偏高 — 模式僅供參考，請優先查版本歸因。</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
