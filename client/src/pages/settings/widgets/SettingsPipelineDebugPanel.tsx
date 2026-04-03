import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle, Clock, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RefreshStatus, SyncedAccount } from "@shared/schema";

export function SettingsPipelineDebugPanel() {
  const { data: refreshStatus } = useQuery<RefreshStatus>({
    queryKey: ["/api/refresh/status"],
  });
  const { data: syncedData } = useQuery<{ accounts: SyncedAccount[] }>({
    queryKey: ["/api/accounts/synced"],
  });
  const { data: summaryData } = useQuery<{ hasSummary: boolean; summary?: Record<string, unknown> }>({
    queryKey: ["/api/dashboard/cross-account-summary"],
  });

  const accounts = syncedData?.accounts || [];
  const metaAccounts = accounts.filter((a) => a.platform === "meta");
  const ga4Accounts = accounts.filter((a) => a.platform === "ga4");
  const summary = summaryData?.summary as
    | {
        analysisBatchId?: string;
        aiModelUsed?: string;
        dataScope?: string;
      }
    | undefined;

  const fmtTs = (ts: string | null | undefined) => {
    if (!ts) return "尚未執行";
    const d = new Date(ts);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
  };

  const rows: { label: string; value: string; status?: "ok" | "warn" | "error" }[] = [
    { label: "Meta 廣告帳號數", value: `${metaAccounts.length} 個`, status: metaAccounts.length > 0 ? "ok" : "warn" },
    { label: "GA4 Property 數", value: `${ga4Accounts.length} 個`, status: ga4Accounts.length > 0 ? "ok" : "warn" },
    { label: "最後數據擷取時間", value: fmtTs(refreshStatus?.lastRefreshedAt), status: refreshStatus?.lastRefreshedAt ? "ok" : "warn" },
    { label: "最後分析時間", value: fmtTs(refreshStatus?.lastAnalysisAt), status: refreshStatus?.lastAnalysisAt ? "ok" : "warn" },
    { label: "最後 AI 摘要時間", value: fmtTs(refreshStatus?.lastAiSummaryAt), status: refreshStatus?.lastAiSummaryAt ? "ok" : "warn" },
    { label: "Analysis Batch ID", value: summary?.analysisBatchId || "N/A" },
    { label: "AI 模型", value: summary?.aiModelUsed || "N/A" },
    {
      label: "數據涵蓋範圍",
      value:
        summary?.dataScope === "both"
          ? "Meta + GA4"
          : summary?.dataScope === "meta_only"
            ? "僅 Meta"
            : summary?.dataScope === "ga4_only"
              ? "僅 GA4"
              : "無數據",
    },
    {
      label: "Pipeline 狀態",
      value: refreshStatus?.isRefreshing
        ? `執行中: ${refreshStatus.currentStep} (${refreshStatus.progress}%)`
        : "閒置",
      status: refreshStatus?.isRefreshing ? "warn" : "ok",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Pipeline 觀測面板
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">檢視數據擷取、分析引擎、AI 摘要產生的完整狀態。</p>
      </CardHeader>
      <CardContent className="space-y-1" data-testid="section-debug-panel">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
            data-testid={`debug-row-${idx}`}
          >
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{row.value}</span>
              {row.status === "ok" && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
              {row.status === "warn" && <Clock className="w-3.5 h-3.5 text-amber-500" />}
              {row.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
            </div>
          </div>
        ))}
        {metaAccounts.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">已同步的 Meta 帳號 (前 5 個)</p>
            <div className="space-y-1">
              {metaAccounts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs py-1">
                  <span>{a.accountName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {a.status === "active" ? "啟用中" : "已停用"}
                  </Badge>
                </div>
              ))}
              {metaAccounts.length > 5 && (
                <p className="text-xs text-muted-foreground">... 還有 {metaAccounts.length - 5} 個帳號</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
