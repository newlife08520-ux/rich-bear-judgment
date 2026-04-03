/**
 * Batch 9.3 / 9.7：首頁「戰略資料真相」— partial 更醒目、先講「你仍可先做什麼」。
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomepageDataTruth } from "@shared/homepage-data-truth";

export function HomepageDataTruthSection({
  dataStatus,
  homepageDataTruth,
  hasDecisionSignals,
  summaryMessage,
  coverageNote,
  partialHomepage,
  scopeMismatch,
  batchWeak,
}: {
  dataStatus?: string;
  homepageDataTruth?: HomepageDataTruth;
  hasDecisionSignals?: boolean;
  summaryMessage?: string | null;
  coverageNote?: string | null;
  partialHomepage: boolean;
  scopeMismatch: boolean;
  batchWeak: boolean;
}) {
  const status = dataStatus ?? "unknown";
  const label =
    status === "has_data"
      ? "完整決策資料（has_data）"
      : status === "partial_data"
        ? "部分資料（partial_data）"
        : status === "synced_no_data"
          ? "已同步但無批次（synced_no_data）"
          : status === "no_sync"
            ? "尚未同步（no_sync）"
            : "狀態未知";

  const tone =
    status === "has_data"
      ? "border-emerald-200/80 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900/50"
      : status === "partial_data"
        ? "border-sky-400/90 bg-sky-50/70 dark:bg-sky-950/30 dark:border-sky-700/60"
        : "border-border bg-muted/20";

  const partialRing = partialHomepage
    ? "ring-2 ring-sky-500/80 dark:ring-sky-500/50 ring-offset-4 ring-offset-background shadow-lg shadow-sky-500/10"
    : "";

  const firstDoLine =
    status === "no_sync" || status === "synced_no_data"
      ? "你仍可先做：完成同步或重新整理批次後，再看今日戰略指令。"
      : partialHomepage && hasDecisionSignals
        ? "你仍可先做：依今日戰略指令與三桶行動；摘要層晚到不阻擋數值決策。"
        : partialHomepage
          ? "你仍可先做：以 action-center 五區為準，並留意下方覆蓋度警示。"
          : hasDecisionSignals
            ? "你仍可先做：依今日戰略指令排序執行，再看沉睡復活與賺賠。"
            : "你仍可先做：先更新資料或縮小範圍，直到出現決策訊號。";

  return (
    <section data-testid="section-homepage-data-truth" aria-label="戰略資料真相與覆蓋度">
      <Card
        data-testid="block-war-room-truth-salience"
        className={cn("shadow-md ring-1 ring-black/5", tone, partialRing)}
      >
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div
            className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 space-y-2"
            data-testid="block-strategic-decision-framing"
          >
            <p className="text-xs font-semibold text-primary">決策取景（30–60 秒）</p>
            <ol className="text-xs text-foreground/90 space-y-1 list-decimal list-inside leading-relaxed">
              <li>
                <strong>今日戰略指令</strong>：最優先動作（放大／救援／不要誤殺等）。
              </li>
              <li>
                <strong>加碼（Scale）／救援（Rescue）／觀察（Hold）</strong>：錢與節奏的三桶；零花費另列，不混入主分類。
              </li>
              <li>
                <strong>復活（沉睡／暫停高潛）</strong>：與 no_delivery／樣本不足<strong>分桶</strong>。
              </li>
              <li>
                <strong>本卡</strong>：此刻能信什麼；partial 時仍可信 action-center 五區與三桶。
              </li>
            </ol>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Database className="w-5 h-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">資料真相與覆蓋度</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  與「今日戰略指令」並列：先判定完整／partial／風險，再下指揮語。
                </p>
              </div>
            </div>
            <Badge
              variant={status === "partial_data" ? "default" : "secondary"}
              className={cn(
                "shrink-0 text-xs font-semibold",
                status === "partial_data" && "bg-sky-600 hover:bg-sky-600 text-white"
              )}
              data-testid="badge-homepage-data-status"
            >
              {label}
            </Badge>
          </div>

          <p className="text-sm text-foreground/90 leading-relaxed">{summaryMessage || "—"}</p>

          <p
            className="text-sm font-medium text-primary border-l-4 border-primary/40 pl-3 py-1.5 bg-primary/[0.04] rounded-r-md"
            data-testid="strip-first-do-line"
          >
            {firstDoLine}
          </p>

          <div
            className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5 space-y-1.5"
            data-testid="strip-trusted-vs-reference-zones"
          >
            <p className="text-[11px] font-semibold text-foreground">可信區 vs 僅供參考</p>
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
              <li>
                <strong className="text-emerald-800 dark:text-emerald-200">較可信</strong>：今日戰略指令、action-center 五區數值、戰略三桶、沉睡復活候選（皆來自同一批次與範圍鍵）。
              </li>
              <li>
                <strong className="text-amber-800 dark:text-amber-200">僅供參考／易變</strong>：跨帳摘要文案、Pareto 敘事層、目標節奏敘事—partial 或批次偏弱時優先以數值區為準。
              </li>
            </ul>
          </div>

          {partialHomepage && (
            <div
              className="rounded-lg border-[3px] border-sky-500/85 dark:border-sky-500/70 bg-sky-50/50 dark:bg-sky-950/25 px-3 py-2.5 space-y-2 shadow-md shadow-sky-500/15"
              data-testid="strip-partial-data-guidance"
            >
              <p className="text-xs font-semibold text-sky-950 dark:text-sky-100 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                partial_data：與「全無資料」不同 — 請優先信這幾區
              </p>
              <ul className="text-xs text-sky-900/90 dark:text-sky-100/90 space-y-1 list-disc list-inside">
                <li>
                  <strong>今日戰略指令、戰略三桶（加碼／救援／Hold）、賺賠總覽</strong>：
                  <span className="font-mono text-[11px]"> GET /api/dashboard/action-center</span>
                </li>
                <li>
                  <strong>AI 摘要層</strong>：可能缺失；不阻擋上述數值決策。
                </li>
                <li>
                  <strong>Pareto／目標節奏</strong>：請一併看資料健康與本卡下方警示。
                </li>
                <li>
                  決策訊號：
                  <span className="font-mono">{hasDecisionSignals ? "hasDecisionSignals=true" : "false"}</span>
                </li>
              </ul>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-2 text-xs border-t border-border/60 pt-3">
            <div className="flex gap-2 items-start">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">Cross-account / 摘要層</span>
                <p className="text-muted-foreground mt-0.5">
                  {homepageDataTruth === "summary_ok"
                    ? "摘要就緒（完整）"
                    : partialHomepage
                      ? "摘要缺失，但可有決策資料（partial）"
                      : status === "no_sync" || status === "synced_no_data"
                        ? "沒資料／未同步"
                        : "無摘要或無決策"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <CheckCircle2
                className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", hasDecisionSignals ? "text-emerald-600" : "text-muted-foreground")}
              />
              <div>
                <span className="font-medium text-foreground">Action center 活動／商品層</span>
                <p className="text-muted-foreground mt-0.5">{hasDecisionSignals ? "有批次明細，五區可算" : "明細不足"}</p>
              </div>
            </div>
          </div>

          {(coverageNote || scopeMismatch || batchWeak) && (
            <div className="flex flex-wrap gap-2 text-[11px] text-amber-900 dark:text-amber-100">
              {coverageNote && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-300/50 px-2 py-1 bg-amber-50/50 dark:bg-amber-950/30">
                  <AlertCircle className="w-3 h-3" />
                  覆蓋度：{coverageNote}
                </span>
              )}
              {scopeMismatch && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-300/50 px-2 py-1">
                  範圍與資料不一致（請更新資料）
                </span>
              )}
              {batchWeak && <span className="inline-flex items-center gap-1 rounded border px-2 py-1">批次有效性偏弱</span>}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            可見性政策、未投遞／樣本細節在下方「資料信任、範圍與政策」摺疊；診斷不與今日指令混排。
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
