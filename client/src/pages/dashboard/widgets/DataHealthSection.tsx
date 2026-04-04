/**
 * 區塊 5：資料健康。最後更新、batch 有效性、scope 一致、未投遞/樣本不足/未映射、漏斗證據、引導更新/設定規則。
 */
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Shield, Clock, Calculator, AlertTriangle } from "lucide-react";
import { formatTimestamp } from "../dashboard-formatters";

interface DataHealthDerived {
  lastRefreshedAt: string | null;
  batchValidity?: "valid" | "legacy" | "insufficient";
  batchValidityReason?: string;
  sourceMeta?: { scopeKey: string | null; batchId: string | null; generatedAt: string | null };
  scopeMismatch: boolean;
  noDeliveryCount: number;
  underSampleCount: number;
  unmappedCount: number;
  funnelEvidence?: boolean;
  dormantGemCount?: number;
  homepagePartial?: boolean;
  homepageCoverageNote?: string | null;
}

export function DataHealthSection({ health }: { health: DataHealthDerived }) {
  const {
    lastRefreshedAt,
    batchValidity,
    batchValidityReason,
    scopeMismatch,
    noDeliveryCount,
    underSampleCount,
    unmappedCount,
    funnelEvidence,
    dormantGemCount = 0,
    homepagePartial,
    homepageCoverageNote,
  } = health;

  return (
    <section data-testid="section-data-health">
      <Card className="border-border/80 bg-muted/10 hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0" />
            資料健康
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              最後更新：{formatTimestamp(lastRefreshedAt)}
            </li>
            {homepagePartial && (
              <li className="text-sky-800 dark:text-sky-200">
                目前為「摘要缺失、決策層可用」狀態：下方五區與行動中心同源，可依活動／商品資料操作；執行刷新可補齊帳號級摘要。
              </li>
            )}
            {batchValidity && batchValidity !== "valid" && (
              <li className={batchValidity === "insufficient" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
                本批狀態：
                {batchValidity === "insufficient"
                  ? homepagePartial
                    ? "批次標記為不足（多為缺摘要），但活動列仍可供決策參考"
                    : "資料不足"
                  : "舊版資料僅供參考"}
                {batchValidityReason && `（${batchValidityReason}）`}
              </li>
            )}
            {homepageCoverageNote && (
              <li className="text-amber-800 dark:text-amber-200 text-xs">{homepageCoverageNote}</li>
            )}
            {dormantGemCount > 0 && (
              <li className="text-muted-foreground">
                沉睡贏家／休眠高潛候選 {dormantGemCount} 筆（主視窗花費為 0，但 7／14 日視窗曾有表現）；見{" "}
                <Link href="/fb-ads" className="text-primary/80 hover:underline">
                  FB 廣告
                </Link>{" "}
                或政策文件 DEFAULT-VISIBILITY-POLICY。
              </li>
            )}
            {scopeMismatch && (
              <li className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                目前查看範圍與資料範圍不一致，請點「更新資料」取得正確範圍的決策。
              </li>
            )}
            {(noDeliveryCount > 0 || underSampleCount > 0) && (
              <li className="text-muted-foreground">
                未投遞 {noDeliveryCount} 筆、樣本不足 {underSampleCount} 筆，不參與核心決策。
              </li>
            )}
            {unmappedCount > 0 && (
              <li className="text-muted-foreground">未分類／未映射商品 {unmappedCount} 筆。</li>
            )}
            {funnelEvidence === false && (
              <li className="text-amber-700 dark:text-amber-400">無漏斗資料，決策區為廣告層推測，不建議單獨定罪。</li>
            )}
            <li className="text-muted-foreground pt-1">
              規則缺失或樣本不足時請先別亂動；欲減少「規則缺失」請至{" "}
              <Link href="/settings/profit-rules" className="text-primary/80 hover:underline inline-flex items-center gap-1">
                <Calculator className="w-3 h-3" />
                獲利規則中心
              </Link>{" "}
              設定成本比與目標淨利率。
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
