/**
 * 首頁「資料狀態」：使用者語言，不含路徑／內部狀態代碼。
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
  summarySource,
  coverageNote,
  partialHomepage,
  scopeMismatch,
  batchWeak,
}: {
  dataStatus?: string;
  homepageDataTruth?: HomepageDataTruth;
  hasDecisionSignals?: boolean;
  summaryMessage?: string | null;
  summarySource?: "ai" | "deterministic";
  coverageNote?: string | null;
  partialHomepage: boolean;
  scopeMismatch: boolean;
  batchWeak: boolean;
}) {
  const status = dataStatus ?? "unknown";
  const label =
    status === "has_data"
      ? "資料完整"
      : status === "partial_data"
        ? "部分資料"
        : status === "synced_no_data"
          ? "已同步，尚無分析結果"
          : status === "no_sync"
            ? "尚未同步"
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
      ? "你仍可先做：完成同步或更新資料後，再看今日戰略指令。"
      : partialHomepage && hasDecisionSignals
        ? "你仍可先做：依今日戰略指令與三桶行動；摘要晚到不影響數值決策。"
        : partialHomepage
          ? "你仍可先做：以五大決策區數值為準，並留意下方覆蓋度提示。"
          : hasDecisionSignals
            ? "你仍可先做：依今日戰略指令排序執行，再看沉睡復活與賺賠。"
            : "你仍可先做：先更新資料或縮小範圍，直到出現決策訊號。";

  return (
    <section data-testid="section-homepage-data-truth" aria-label="資料狀態與覆蓋度">
      <Card
        data-testid="block-war-room-truth-salience"
        className={cn("shadow-md ring-1 ring-black/5 hover:shadow-lg transition-shadow", tone, partialRing)}
      >
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div
            className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 space-y-2"
            data-testid="block-strategic-decision-framing"
          >
            <p className="text-xs font-semibold text-primary">決策取景（約 30–60 秒）</p>
            <ol className="text-xs text-foreground/90 space-y-1 list-decimal list-inside leading-relaxed">
              <li>
                <strong>今日戰略指令</strong>：最優先動作（放大／救援／觀察等）。
              </li>
              <li>
                <strong>加碼／救援／觀察</strong>：預算與節奏三桶；零花費另列，不混入主分類。
              </li>
              <li>
                <strong>沉睡復活候選</strong>：與「尚未投遞／樣本不足」分開呈現。
              </li>
              <li>
                <strong>本卡</strong>：此刻能信什麼；部分資料時仍可信任五大決策區與三桶。
              </li>
            </ol>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Database className="w-5 h-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">資料狀態</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  與「今日戰略指令」並列：先確認完整度，再下指令。
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

          <p className="text-sm text-foreground/90 leading-relaxed flex flex-wrap items-center gap-x-1">
            <span>{summaryMessage || "—"}</span>
            {summarySource === "deterministic" && (
              <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5 ml-2 shrink-0">
                規則摘要（非 AI 生成）
              </span>
            )}
          </p>

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
                <strong className="text-emerald-800 dark:text-emerald-200">較可信</strong>
                ：今日戰略指令、五大決策區數值、戰略三桶、沉睡復活候選（同一資料範圍）。
              </li>
              <li>
                <strong className="text-amber-800 dark:text-amber-200">僅供參考／易變</strong>
                ：跨帳摘要文案、營運敘事—若與數字牴觸，以左欄數值為準。
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
                部分資料：與「全無資料」不同 — 請優先信賴下列區塊
              </p>
              <ul className="text-xs text-sky-900/90 dark:text-sky-100/90 space-y-1 list-disc list-inside">
                <li>
                  <strong>今日戰略指令、戰略三桶（加碼／救援／觀察）、賺賠總覽</strong>
                </li>
                <li>
                  <strong>AI 摘要層</strong>：可能較晚出現；不阻擋上述數值決策。
                </li>
                <li>
                  <strong>營運分析敘事</strong>：請一併看資料健康與本卡下方提示。
                </li>
              </ul>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-2 text-xs border-t border-border/60 pt-3">
            <div className="flex gap-2 items-start">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">跨帳摘要</span>
                <p className="text-muted-foreground mt-0.5">
                  {homepageDataTruth === "summary_ok"
                    ? "摘要就緒（完整）"
                    : partialHomepage
                      ? "摘要可能缺失，但可有決策資料"
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
                <span className="font-medium text-foreground">活動與商品明細</span>
                <p className="text-muted-foreground mt-0.5">{hasDecisionSignals ? "明細足夠，五大決策區可算" : "明細不足"}</p>
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
              {batchWeak && (
                <span className="inline-flex items-center gap-1 rounded border px-2 py-1">資料有效度偏低，建議更新後再參考</span>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            可見性政策與診斷細節在下方「資料狀態」摺疊區；不與今日指令混排。
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
