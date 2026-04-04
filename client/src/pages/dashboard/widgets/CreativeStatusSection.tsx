/**
 * 區塊 4：素材狀態。client 端分類：待換/疲勞/勝出/續測；優先順序 疲勞 > 待換 > 勝出 > 續測。
 */
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Zap } from "lucide-react";
import { formatCurrency } from "../dashboard-formatters";
import type { CreativeLeaderboardItem } from "../dashboard-types";

/** 黑馬/潛力素材可能只有基本欄位 */
type CreativeRowMinimal = Pick<CreativeLeaderboardItem, "productName" | "materialStrategy" | "headlineSnippet" | "spend" | "revenue" | "roas">;

interface CreativeStatusDerived {
  countReplace: number;
  countFatigue: number;
  countWin: number;
  countRetest: number;
  sampleReplace: CreativeLeaderboardItem[];
  sampleFatigue: CreativeLeaderboardItem[];
  sampleWin: CreativeLeaderboardItem[];
  sampleRetest: CreativeLeaderboardItem[];
  tierHighPotential: CreativeRowMinimal[];
}

function CreativeItem({ c, label }: { c: CreativeLeaderboardItem | CreativeRowMinimal; label?: string }) {
  return (
    <li className="rounded-lg border border-border/60 bg-muted/20 p-2 text-sm">
      {label && <span className="text-xs text-muted-foreground uppercase mr-1">{label}</span>}
      <p className="font-medium truncate">{c.productName} · {c.materialStrategy}</p>
      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.headlineSnippet}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        花費 {formatCurrency(c.spend)} · ROAS {c.roas.toFixed(2)}
      </p>
    </li>
  );
}

export function CreativeStatusSection({ status }: { status: CreativeStatusDerived }) {
  const {
    countReplace,
    countFatigue,
    countWin,
    countRetest,
    sampleReplace,
    sampleFatigue,
    sampleWin,
    sampleRetest,
    tierHighPotential,
  } = status;

  return (
    <section data-testid="section-creative-status">
      <Card className="border-border/80 hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              素材狀態
            </h2>
            <Link href="/creatives" className="text-xs text-muted-foreground hover:text-primary shrink-0">
              前往素材審判 →
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 text-sm mb-4">
            <span className="text-red-600 dark:text-red-400">待換 {countReplace}</span>
            <span className="text-amber-600 dark:text-amber-400">疲勞 {countFatigue}</span>
            <span className="text-emerald-600 dark:text-emerald-400">勝出 {countWin}</span>
            <span className="text-muted-foreground">續測 {countRetest}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sampleReplace.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1.5">待換代表</h3>
                <ul className="space-y-1.5">
                  {sampleReplace.map((c, i) => (
                    <CreativeItem key={`${c.productName}-${c.materialStrategy}-${i}`} c={c} />
                  ))}
                </ul>
              </div>
            )}
            {sampleFatigue.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1.5">疲勞代表</h3>
                <ul className="space-y-1.5">
                  {sampleFatigue.map((c, i) => (
                    <CreativeItem key={`${c.productName}-${c.materialStrategy}-${i}`} c={c} />
                  ))}
                </ul>
              </div>
            )}
            {sampleWin.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1.5">勝出代表</h3>
                <ul className="space-y-1.5">
                  {sampleWin.map((c, i) => (
                    <CreativeItem key={`${c.productName}-${c.materialStrategy}-${i}`} c={c} />
                  ))}
                </ul>
              </div>
            )}
            {(sampleRetest.length > 0 || tierHighPotential.length > 0) && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1.5">續測 / 黑馬</h3>
                <ul className="space-y-1.5">
                  {tierHighPotential.slice(0, 2).map((c, i) => (
                    <CreativeItem key={`hp-${c.productName}-${i}`} c={c} label="黑馬" />
                  ))}
                  {sampleRetest.slice(0, 2).map((c, i) => (
                    <CreativeItem key={`retest-${c.productName}-${i}`} c={c} />
                  ))}
                </ul>
              </div>
            )}
          </div>
          {countReplace === 0 && countFatigue === 0 && countWin === 0 && countRetest === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center rounded-lg bg-muted/20 border border-dashed border-border/60">
              本批尚無素材維度資料，請先更新資料或至素材審判查看。
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
