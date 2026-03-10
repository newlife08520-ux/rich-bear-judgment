import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Percent,
  Image,
  Globe,
  Megaphone,
  ArrowRight,
  Gavel,
  ListChecks,
  Zap,
  AlertTriangle,
  ShoppingCart,
  Target,
  RefreshCw,
  Shield,
  Activity,
  BarChart3,
  Clock,
  ChevronRight,
  Flame,
  TrendingDown,
  Eye,
  StopCircle,
  Rocket,
  LayoutDashboard,
  Trophy,
  Crown,
  Bot,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppScope } from "@/hooks/use-app-scope";
import { useEmployee, getDepartmentLabel } from "@/lib/employee-context";
import { DateRangeSelector } from "@/components/shared/date-range-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { V2ScoreMini, DiagnosisBadge, ActionBadge, ScoringInline, BenchmarkInfo } from "@/components/shared/v2-scoring";
import type {
  AdAccount,
  TodayVerdict,
  TodayPriority,
  HighRiskItem,
  BusinessOverview,
  CrossAccountSummary,
  AccountHealthScore,
  Anomaly,
  RiskyCampaign,
  RefreshStatus,
  TriScore,
  RiskLevel,
  OpportunityCandidate,
  ScoringResult,
  BoardSet,
  BoardEntry,
} from "@shared/schema";

function formatCurrency(value: number): string {
  return `NT$ ${value.toLocaleString()}`;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "尚未更新";
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function healthStatusColor(status: string) {
  switch (status) {
    case "danger": return "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950";
    case "warning": return "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950";
    default: return "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950";
  }
}

function healthStatusLabel(status: string) {
  switch (status) {
    case "danger": return "危險";
    case "warning": return "注意";
    default: return "正常";
  }
}

function suggestionIcon(suggestion: string) {
  switch (suggestion) {
    case "stop": return <StopCircle className="w-3.5 h-3.5 text-red-500" />;
    case "observe": return <Eye className="w-3.5 h-3.5 text-amber-500" />;
    case "scale": return <Rocket className="w-3.5 h-3.5 text-emerald-500" />;
    default: return null;
  }
}

const riskLevelConfig: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  danger: { bg: "bg-red-100", text: "text-red-700", label: "危險" },
  warning: { bg: "bg-amber-100", text: "text-amber-700", label: "警告" },
  watch: { bg: "bg-yellow-100", text: "text-yellow-700", label: "觀察" },
  stable: { bg: "bg-green-100", text: "text-green-700", label: "穩定" },
  potential: { bg: "bg-blue-100", text: "text-blue-700", label: "潛力" },
};

function RiskLevelBadge({ level }: { level?: RiskLevel }) {
  if (!level) return null;
  const config = riskLevelConfig[level];
  return (
    <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 border-transparent", config.bg, config.text)} data-testid={`badge-risk-${level}`}>
      {config.label}
    </Badge>
  );
}

function TriScoreMini({ triScore }: { triScore?: TriScore }) {
  if (!triScore) return null;
  const items = [
    { label: "健康", value: triScore.health, color: "bg-emerald-500" },
    { label: "急迫", value: triScore.urgency, color: "bg-amber-500" },
    { label: "潛力", value: triScore.scalePotential, color: "bg-blue-500" },
  ];
  return (
    <div className="flex items-center gap-1.5" data-testid="tri-score-mini">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-0.5" title={`${item.label}: ${item.value}`}>
          <div className="w-1.5 h-4 rounded-sm bg-muted overflow-hidden flex flex-col-reverse">
            <div className={cn("w-full rounded-sm", item.color)} style={{ height: `${item.value}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function HeroSummaryCard({ summary, isLoading }: { summary?: CrossAccountSummary; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="border-amber-200 dark:border-amber-800" data-testid="card-hero-summary">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-10 h-10 rounded-md" />
            <Skeleton className="w-48 h-6" />
          </div>
          <Skeleton className="w-full h-8 mb-3" />
          <Skeleton className="w-3/4 h-5" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="border-amber-200 dark:border-amber-800" data-testid="card-hero-summary">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0">
              <Gavel className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-muted-foreground" data-testid="text-hero-title">
                今天的操盤判斷
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                {summary.dataScope !== "none" && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-data-scope">
                    {summary.dataScope === "both" ? "Meta + GA4" : summary.dataScope === "meta_only" ? "Meta" : "GA4"}
                  </Badge>
                )}
                {summary.aiLastGeneratedAt && (
                  <span className="text-xs text-muted-foreground" data-testid="text-ai-timestamp">
                    AI 產生於 {formatTimestamp(summary.aiLastGeneratedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
          {(() => {
            const raw = summary.executiveSummary || "尚未產生分析摘要，請點擊「更新資料」按鈕開始分析。";
            const lines = raw.split("。").filter(l => l.trim());
            if (lines.length <= 1) {
              return <p className="text-xl md:text-2xl font-bold font-display leading-relaxed" data-testid="text-hero-summary">{raw}</p>;
            }
            return (
              <div data-testid="text-hero-summary" className="space-y-2">
                <p className="text-xl md:text-2xl font-bold font-display leading-relaxed">{lines[0]}。</p>
                {lines.slice(1).map((line, i) => {
                  const isAction = line.includes("今天先做");
                  const isScale = line.includes("本週加碼");
                  const isDont = line.includes("先不要動");
                  const colorClass = isAction
                    ? "text-red-600 dark:text-red-400"
                    : isScale
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isDont
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-foreground/80";
                  return (
                    <p key={i} className={`text-sm font-medium leading-relaxed ${colorClass}`}>
                      {line}。
                    </p>
                  );
                })}
              </div>
            );
          })()}
          {summary.dateLabel && (
            <Badge variant="outline" className="mt-3 text-xs" data-testid="badge-date-label">
              分析區間: {summary.dateLabel}
            </Badge>
          )}
          {summary.problemDiagnosis && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="section-problem-diagnosis">
              {[
                { key: "adIssues", label: "廣告端", icon: "ads", value: summary.problemDiagnosis.adIssues },
                { key: "pageIssues", label: "頁面端", icon: "page", value: summary.problemDiagnosis.pageIssues },
                { key: "trackingIssues", label: "追蹤", icon: "tracking", value: summary.problemDiagnosis.trackingIssues },
                { key: "marketFactors", label: "市場因素", icon: "market", value: summary.problemDiagnosis.marketFactors },
              ].filter(d => d.value && d.value !== "無明顯廣告端異常" && d.value !== "無明顯頁面端異常" && d.value !== "追蹤正常" && d.value !== "未偵測到明顯市場因素").map(d => (
                <div key={d.key} className="p-3 rounded-lg bg-muted/40 text-xs" data-testid={`diagnosis-${d.key}`}>
                  <p className="font-semibold text-muted-foreground mb-1">{d.label}</p>
                  <p className="text-foreground leading-relaxed">{d.value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TopPriorityAccountsSection({ accounts, isLoading }: { accounts: AccountHealthScore[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div data-testid="section-top-priority">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="w-8 h-8 rounded-md" />
          <Skeleton className="w-48 h-5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-28" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (accounts.length === 0) return null;

  const top3 = accounts.slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
      <div data-testid="section-top-priority">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-md bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="section-title" data-testid="text-top-priority-title">這幾個帳號，今天最需要你盯一下</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((account, idx) => (
            <Card key={account.accountId} className="hover-elevate" data-testid={`card-priority-account-${idx}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" data-testid={`text-priority-name-${idx}`}>{account.accountName}</p>
                      <Badge variant="secondary" className="text-xs mt-0.5">{account.platform === "meta" ? "Meta" : "GA4"}</Badge>
                    </div>
                  </div>
                  <Badge className={cn("text-xs", healthStatusColor(account.healthStatus))} data-testid={`badge-health-${idx}`}>
                    {healthStatusLabel(account.healthStatus)}
                  </Badge>
                  <ScoringInline scoring={account.scoring} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <span className="text-muted-foreground">Priority</span>
                    <p className="font-bold text-base" data-testid={`text-priority-score-${idx}`}>{account.priorityScore}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ROAS</span>
                    <p className="font-bold text-base" data-testid={`text-priority-roas-${idx}`}>{account.roas.toFixed(2)}</p>
                  </div>
                </div>
                <div className="text-xs">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-1" data-testid={`text-top-problem-${idx}`}>
                    {account.aiPriorityReason || account.topProblem}
                  </p>
                  {account.aiRootCause && (
                    <Badge variant="outline" className="text-[10px] mb-1" data-testid={`badge-root-cause-${idx}`}>
                      {account.aiRootCause === "ads" ? "廣告問題" : account.aiRootCause === "page" ? "頁面問題" : account.aiRootCause === "tracking" ? "追蹤問題" : account.aiRootCause === "budget" ? "預算問題" : account.aiRootCause === "fatigue" ? "素材疲勞" : account.aiRootCause}
                    </Badge>
                  )}
                  <p className="text-muted-foreground" data-testid={`text-suggested-action-${idx}`}>
                    {account.suggestedAction}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function AccountRankingTable({ accounts, isLoading }: { accounts: AccountHealthScore[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card data-testid="card-account-ranking">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-8 h-8 rounded-md" />
            <Skeleton className="w-48 h-5" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 mb-2" />)}
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
      <Card data-testid="card-account-ranking">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-md bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="section-title" data-testid="text-ranking-title">各帳號體檢表</h3>
          </div>
          <div className="table-scroll-container">
            <table className="w-full text-sm" data-testid="table-account-ranking">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3">帳號</th>
                  <th className="text-center py-2 px-2">V2 評分</th>
                  <th className="text-right py-2 px-2">花費</th>
                  <th className="text-right py-2 px-2">營收</th>
                  <th className="text-right py-2 px-2">ROAS</th>
                  <th className="text-right py-2 px-2">轉換率</th>
                  <th className="text-center py-2 px-2">異常</th>
                  <th className="text-center py-2 px-2">Priority</th>
                  <th className="text-center py-2 px-2">風險</th>
                  <th className="text-center py-2 pl-2">狀態</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a, idx) => (
                  <tr key={a.accountId} className="border-b last:border-0" data-testid={`row-account-${idx}`}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs shrink-0">{a.platform === "meta" ? "M" : "G"}</Badge>
                        <span className="font-medium truncate max-w-[200px]">{a.accountName}</span>
                        <RiskLevelBadge level={a.riskLevel} />
                        {a.scoring && <DiagnosisBadge diagnosis={a.scoring.diagnosis} />}
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      {a.scoring ? <V2ScoreMini scoring={a.scoring} /> : <TriScoreMini triScore={a.triScore} />}
                    </td>
                    <td className="text-right py-2.5 px-2 whitespace-nowrap">{formatCurrency(a.spend)}</td>
                    <td className="text-right py-2.5 px-2 whitespace-nowrap">{formatCurrency(a.revenue)}</td>
                    <td className={cn("text-right py-2.5 px-2 font-medium", a.roas < 1 ? "text-red-600" : a.roas >= 3 ? "text-emerald-600" : "")}>
                      {a.roas.toFixed(2)}
                    </td>
                    <td className="text-right py-2.5 px-2">{a.conversionRate.toFixed(2)}%</td>
                    <td className="text-center py-2.5 px-2">
                      {a.anomalyCount > 0 ? (
                        <Badge variant="destructive" className="text-xs">{a.anomalyCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <span className="font-bold">{a.priorityScore}</span>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <RiskLevelBadge level={a.riskLevel} />
                    </td>
                    <td className="text-center py-2.5 pl-2">
                      <Badge className={cn("text-xs", healthStatusColor(a.healthStatus))}>
                        {healthStatusLabel(a.healthStatus)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RiskyCampaignsSection({ campaigns, isLoading }: { campaigns: RiskyCampaign[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card data-testid="card-risky-campaigns">
        <CardContent className="p-5">
          <Skeleton className="w-48 h-5 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 mb-2" />)}
        </CardContent>
      </Card>
    );
  }

  if (campaigns.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
      <Card data-testid="card-risky-campaigns">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-md bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="section-title" data-testid="text-risky-title">這些活動正在燒錢，要不要先處理？</h3>
          </div>
          <div className="space-y-3">
            {campaigns.map((c, idx) => (
              <div key={`${c.campaignId}-${idx}`} className="flex items-start gap-3 p-3 rounded-md bg-muted/40" data-testid={`card-risky-${idx}`}>
                {suggestionIcon(c.suggestion)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold">{c.campaignName}</span>
                    <Badge variant="secondary" className="text-xs">{c.accountName}</Badge>
                    <Badge className={cn("text-xs", c.suggestion === "stop" ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400" : c.suggestion === "scale" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400")}>
                      {c.suggestionLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{c.problemDescription}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <span>花費: {formatCurrency(c.spend)}</span>
                    <span>ROAS: {c.roas.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AnomalySummarySection({ anomalies, isLoading }: { anomalies: Anomaly[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card data-testid="card-anomaly-summary">
        <CardContent className="p-5">
          <Skeleton className="w-48 h-5 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (anomalies.length === 0) return null;

  const categories = [
    { key: "ads" as const, label: "廣告異常", icon: Megaphone, color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950" },
    { key: "funnel" as const, label: "漏斗異常", icon: TrendingDown, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950" },
    { key: "fatigue" as const, label: "素材疲勞", icon: Activity, color: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950" },
    { key: "tracking" as const, label: "追蹤異常", icon: Shield, color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950" },
  ];

  const grouped = {
    ads: anomalies.filter(a => a.category === "ads"),
    funnel: anomalies.filter(a => a.category === "funnel"),
    fatigue: anomalies.filter(a => a.category === "fatigue"),
    tracking: anomalies.filter(a => a.category === "tracking"),
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
      <Card data-testid="card-anomaly-summary">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="section-title" data-testid="text-anomaly-title">最近偵測到的異常狀況</h3>
            <Badge variant="secondary" className="text-xs ml-auto">{anomalies.length} 個異常</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const items = grouped[cat.key];
              const critical = items.filter(a => a.severity === "critical").length;
              return (
                <div key={cat.key} className={cn("p-3 rounded-md", cat.color)} data-testid={`card-anomaly-cat-${cat.key}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold">{cat.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{items.length}</p>
                  {critical > 0 && <p className="text-xs font-medium mt-0.5">{critical} 個嚴重</p>}
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            {anomalies.filter(a => a.severity === "critical").slice(0, 5).map((a, idx) => (
              <div key={a.id} className="flex items-start gap-2 p-2 rounded-md bg-red-50/50 dark:bg-red-950/30" data-testid={`card-anomaly-critical-${idx}`}>
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold">{a.title}</span>
                    <Badge variant="secondary" className="text-xs">{a.accountName}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AIRecommendationsSection({ summary, isLoading }: { summary?: CrossAccountSummary; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card data-testid="card-ai-recommendations">
        <CardContent className="p-5">
          <Skeleton className="w-48 h-5 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const sections = [
    {
      title: "今天先做",
      items: summary.weeklyRecommendations.today,
      icon: Zap,
      color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
    },
    {
      title: "本週優先",
      items: summary.weeklyRecommendations.thisWeek,
      icon: ListChecks,
      color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
    },
    {
      title: "預算建議",
      items: summary.weeklyRecommendations.budgetAdvice,
      icon: DollarSign,
      color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950",
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
      <Card data-testid="card-ai-recommendations">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-md bg-violet-50 dark:bg-violet-950 flex items-center justify-center shrink-0">
              <ListChecks className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="section-title" data-testid="text-reco-title">接下來可以做這些</h3>
          </div>
          {summary.urgentActions.length > 0 && (
            <div className="space-y-2 mb-4">
              {summary.urgentActions.map((action, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-md bg-muted/40" data-testid={`card-urgent-action-${idx}`}>
                  <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-xs font-bold">
                    {action.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold">{action.action}</span>
                      {action.accountName && <Badge variant="secondary" className="text-xs">{action.accountName}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{action.reason}</p>
                    {action.impact && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                        <Zap className="w-3 h-3" />{action.impact}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="space-y-2" data-testid={`section-reco-${s.title}`}>
                  <div className={cn("flex items-center gap-2 p-2 rounded-md", s.color)}>
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold">{s.title}</span>
                  </div>
                  {s.items.length > 0 ? (
                    <ul className="space-y-1.5">
                      {s.items.map((item, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">尚無建議</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function OpportunitySummaryCard() {
  const { data: oppData, isLoading } = useQuery<{ opportunities: OpportunityCandidate[] }>({
    queryKey: ["/api/fb-ads/opportunities"],
  });

  if (isLoading) {
    return (
      <Card data-testid="card-opportunity-summary">
        <CardContent className="p-5">
          <Skeleton className="w-48 h-5 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const opportunities = oppData?.opportunities || [];
  if (opportunities.length === 0) return null;

  const grouped: Record<string, { typeLabel: string; count: number }> = {};
  for (const opp of opportunities) {
    if (!grouped[opp.type]) {
      grouped[opp.type] = { typeLabel: opp.typeLabel, count: 0 };
    }
    grouped[opp.type].count++;
  }

  const typeIcons: Record<string, typeof Target> = {
    low_spend_high_efficiency: Target,
    stable_scalable: TrendingUp,
    new_potential: Rocket,
    restartable: RefreshCw,
  };

  const typeColors: Record<string, string> = {
    low_spend_high_efficiency: "text-emerald-600 bg-emerald-50",
    stable_scalable: "text-blue-600 bg-blue-50",
    new_potential: "text-violet-600 bg-violet-50",
    restartable: "text-amber-600 bg-amber-50",
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.4 }}>
      <Card data-testid="card-opportunity-summary">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="section-title" data-testid="text-opportunity-summary-title">哪裡還有機會？</h3>
            <Badge variant="secondary" className="text-xs ml-auto">{opportunities.length} 個機會</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(grouped).map(([type, info]) => {
              const Icon = typeIcons[type] || Target;
              const color = typeColors[type] || "text-gray-600 bg-gray-50";
              return (
                <div key={type} className={cn("p-3 rounded-md", color)} data-testid={`card-opp-type-${type}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold">{info.typeLabel}</span>
                  </div>
                  <p className="text-2xl font-bold">{info.count}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickStartSection() {
  const [, navigate] = useLocation();
  const modules = [
    { type: "creative", label: "素材審判", icon: Image, color: "text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-950 dark:border-violet-800" },
    { type: "landing_page", label: "銷售頁審判", icon: Globe, color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800" },
    { type: "fb_ads", label: "FB 廣告審判", icon: Megaphone, color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800" },
    { type: "ga4_funnel", label: "GA4 漏斗審判", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
      <Card data-testid="card-quick-start">
        <CardContent className="p-5">
          <h3 className="section-title mb-3">快速開始</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.type}
                  onClick={() => navigate(`/judgment?type=${m.type}`)}
                  className={`flex items-center gap-2 p-3 rounded-md border transition-colors cursor-pointer ${m.color}`}
                  data-testid={`button-quick-${m.type}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">{m.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-50" />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** 商品戰力紅黑榜：ROAS 最高（賺錢）vs 花費高無轉換（虧錢） */
function ProductRedBlackBoard({
  productLevel,
}: {
  productLevel: Array<{ productName: string; spend: number; revenue: number; roas: number; campaignCount: number }>;
}) {
  if (!productLevel.length) return null;
  const byRoas = [...productLevel].sort((a, b) => b.roas - a.roas);
  const moneyMakers = byRoas.filter((p) => p.roas >= 1).slice(0, 5);
  const moneyLosers = [...productLevel]
    .filter((p) => p.spend > 0 && (p.revenue <= 0 || p.roas < 1))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="section-product-red-black">
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20">
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Trophy className="w-4 h-4" />
              商品戰力紅黑榜 · 最賺錢
            </h3>
            {moneyMakers.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無 ROAS ≥ 1 的商品</p>
            ) : (
              <div className="space-y-2">
                {moneyMakers.map((p, i) => (
                  <div
                    key={p.productName}
                    className="flex items-center justify-between rounded-lg bg-background/60 dark:bg-background/40 px-3 py-2 border border-emerald-200/50 dark:border-emerald-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 w-5">{i + 1}</span>
                      <span className="font-medium">{p.productName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span>ROAS <strong className="text-emerald-700 dark:text-emerald-300">{p.roas.toFixed(2)}</strong></span>
                      <span className="text-muted-foreground">{formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20">
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-700 dark:text-red-400">
              <TrendingDown className="w-4 h-4" />
              花費高無轉換 · 虧錢
            </h3>
            {moneyLosers.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無符合條件的商品</p>
            ) : (
              <div className="space-y-2">
                {moneyLosers.map((p, i) => (
                  <div
                    key={p.productName}
                    className="flex items-center justify-between rounded-lg bg-background/60 dark:bg-background/40 px-3 py-2 border border-red-200/50 dark:border-red-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 w-5">{i + 1}</span>
                      <span className="font-medium">{p.productName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span>花費 {formatCurrency(p.spend)}</span>
                      <span className="text-muted-foreground">ROAS {p.roas.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

const PLACEHOLDER_THUMB = "https://placehold.co/120x90/1a1a2e/eee?text=素材";

/** 素材與文案金榜：轉換率/ROAS 最高的素材組合，霸屏展示 + 縮圖 + 歷史陣亡率警告 */
const MATERIAL_TIER_LABELS: Record<string, string> = {
  Winner: "贏家",
  Potential: "潛力股",
  Borderline: "觀察中",
  Loser: "成效差",
  Unproven: "樣本不足",
};

function CreativeLeaderboardHero({
  creativeLeaderboard,
  failureRatesByTag = {},
  department,
}: {
  creativeLeaderboard: Array<{
    productName: string;
    materialStrategy: string;
    headlineSnippet: string;
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
    cpa: number;
    thumbnailUrl?: string;
    budgetSuggestion?: string;
    materialTier?: string;
  }>;
  failureRatesByTag?: Record<string, number>;
  department?: string;
}) {
  if (!creativeLeaderboard.length) return null;
  const winnerOrPotential = creativeLeaderboard.filter((c) => c.materialTier === "Winner" || c.materialTier === "Potential");
  const topCreatives = [...winnerOrPotential]
    .sort((a, b) => b.revenue - a.revenue || b.roas - a.roas)
    .slice(0, 8);
  if (topCreatives.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/20" data-testid="section-creative-hero">
        <CardContent className="pt-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Crown className="w-4 h-4" />
            素材與文案金榜 · 今天該做哪支圖
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {topCreatives.map((r, i) => {
              const failRate = failureRatesByTag[r.materialStrategy];
              const showSkull = failRate != null && failRate > 0.8;
              return (
                <div
                  key={`${r.productName}-${r.materialStrategy}-${r.headlineSnippet}-${i}`}
                  className="rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow flex"
                >
                  <img
                    src={r.thumbnailUrl || PLACEHOLDER_THUMB}
                    alt=""
                    className="w-24 h-20 object-cover shrink-0 bg-muted"
                  />
                  <div className="flex-1 min-w-0 p-3">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 w-5">{i + 1}</span>
                      <Badge variant="secondary" className="text-[10px]">{r.productName}</Badge>
                      {r.materialTier && (
                        <Badge variant="outline" className="text-[10px] text-amber-600">
                          {MATERIAL_TIER_LABELS[r.materialTier] ?? r.materialTier}
                        </Badge>
                      )}
                    </div>
                    <p className="font-semibold text-sm mb-0.5">
                      {r.materialStrategy} + {r.headlineSnippet}
                    </p>
                    {showSkull && (
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">
                        💀 歷史警報：此類素材 ({r.materialStrategy}) 過去陣亡率達 {Math.round((failRate ?? 0) * 100)}%，強烈建議避免重複測試！
                      </p>
                    )}
                    {department === "AD" && r.budgetSuggestion && (
                      <p className="text-[10px] text-muted-foreground mb-1">{r.budgetSuggestion}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span>ROAS <strong className="text-foreground">{r.roas.toFixed(2)}</strong></span>
                      <span>轉換 {r.conversions}</span>
                      {r.cpa > 0 && <span>CPA {formatCurrency(r.cpa)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** 素材黑榜：成效最差素材 + 縮圖 + 歷史陣亡率警告 + 一鍵 AI 總監驗屍 */
function CreativeBlacklistSection({
  creativeLeaderboard,
  failureRatesByTag = {},
}: {
  creativeLeaderboard: Array<{
    productName: string;
    materialStrategy: string;
    headlineSnippet: string;
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
    cpa: number;
    thumbnailUrl?: string;
    budgetSuggestion?: string;
  }>;
  failureRatesByTag?: Record<string, number>;
}) {
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditVerdict, setAuditVerdict] = useState("");
  const auditMutation = useMutation({
    mutationFn: async (body: { thumbnailUrl?: string; roas: number; spend: number; productName: string; materialStrategy: string; headlineSnippet: string }) => {
      const res = await apiRequest("POST", "/api/dashboard/audit-creative", body);
      return res.json() as Promise<{ verdict: string }>;
    },
    onSuccess: (data) => {
      setAuditVerdict(data.verdict);
      setAuditOpen(true);
    },
  });

  const losersOnly = creativeLeaderboard.filter((c) => c.materialTier === "Loser");
  const worstCreatives = [...losersOnly].sort((a, b) => a.roas - b.roas).slice(0, 6);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}>
        <Card className="border-red-200 dark:border-red-800 bg-red-50/20 dark:bg-red-950/20" data-testid="section-creative-blacklist">
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-red-700 dark:text-red-400">
              <TrendingDown className="w-4 h-4" />
              🚨 素材黑榜 · 成效最差（已達樣本門檻才列入）
            </h3>
            {worstCreatives.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">無符合條件的黑榜素材；樣本不足者不列入，避免誤判。</p>
            ) : (
            <div className="space-y-3">
              {worstCreatives.map((r, i) => {
                const failRate = failureRatesByTag[r.materialStrategy];
                const showSkull = failRate != null && failRate > 0.8;
                return (
                  <div
                    key={`black-${r.productName}-${r.materialStrategy}-${r.headlineSnippet}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-red-200/50 dark:border-red-800/50 bg-card p-3"
                  >
                    <img
                      src={r.thumbnailUrl || PLACEHOLDER_THUMB}
                      alt=""
                      className="w-20 h-16 object-cover rounded-lg shrink-0 bg-muted"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">{r.productName}</Badge>
                        <span className="font-semibold text-sm">{r.materialStrategy} + {r.headlineSnippet}</span>
                      </div>
                      {showSkull && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-0.5">
                          💀 歷史警報：此類素材 ({r.materialStrategy}) 過去陣亡率達 {Math.round((failRate ?? 0) * 100)}%，強烈建議避免重複測試！
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ROAS {r.roas.toFixed(2)} · 花費 {formatCurrency(r.spend)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1"
                      onClick={() => auditMutation.mutate({
                        thumbnailUrl: r.thumbnailUrl,
                        roas: r.roas,
                        spend: r.spend,
                        productName: r.productName,
                        materialStrategy: r.materialStrategy,
                        headlineSnippet: r.headlineSnippet,
                      })}
                      disabled={auditMutation.isPending}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      呼叫總監驗屍
                    </Button>
                  </div>
                );
              })}
            </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              AI 總監驗屍報告
            </DialogTitle>
            <DialogDescription asChild>
              <p className="text-sm leading-relaxed pt-2 whitespace-pre-wrap text-foreground">
                {auditVerdict || "載入中…"}
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmptyStateCard({
  dataStatus,
  message,
}: {
  dataStatus?: "no_sync" | "synced_no_data" | "has_data";
  message?: string;
}) {
  const title =
    dataStatus === "no_sync"
      ? "尚未同步帳號"
      : dataStatus === "synced_no_data"
        ? "尚未擷取數據"
        : "尚未執行數據分析";
  const defaultMessage =
    dataStatus === "no_sync"
      ? "請到設定頁綁定 Facebook / GA4、測試連線成功後點「立即同步帳號」，再回到此頁點「更新資料」。"
      : dataStatus === "synced_no_data"
        ? "已同步帳號但尚未擷取數據。請點上方「更新資料」按鈕。"
        : "請先在設定頁面綁定 Facebook 和/或 GA4，然後點擊上方「更新資料」按鈕。";
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="border-dashed" data-testid="card-empty-state">
        <CardContent className="p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground mb-1">{message ?? defaultMessage}</p>
          <p className="text-sm text-muted-foreground">
            {dataStatus === "no_sync"
              ? "同步後系統會擷取廣告與漏斗數據、執行異常檢測並產生 AI 戰略摘要。"
              : "系統會自動擷取所有帳號的廣告數據與漏斗數據，執行異常檢測，並產生 AI 戰略摘要。"}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function BoardsSection() {
  const { data, isLoading } = useQuery<{ boards: BoardSet }>({
    queryKey: ["/api/boards"],
  });

  if (isLoading) {
    return (
      <Card data-testid="card-boards">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-8 h-8 rounded-md" />
            <Skeleton className="w-48 h-5" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const boards = data?.boards;
  if (!boards) return null;

  const columns: { key: keyof BoardSet; title: string }[] = [
    { key: "dangerBoard", title: "危險警報" },
    { key: "opportunityBoard", title: "擴量機會" },
    { key: "leakageBoard", title: "漏斗漏洞" },
  ];

  const hasEntries = columns.some(col => (boards[col.key] || []).length > 0);
  if (!hasEntries) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.4 }}>
      <Card data-testid="card-boards">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-md bg-orange-50 dark:bg-orange-950 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="section-title" data-testid="text-boards-title">各帳號即時動態</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map((col) => {
              const entries = boards[col.key] || [];
              return (
                <div key={col.key} className="space-y-2" data-testid={`board-column-${col.key}`}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{col.title}</p>
                  {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">暫無資料</p>
                  ) : (
                    entries.map((entry, idx) => (
                      <div key={`${entry.entityId}-${idx}`} className="p-3 rounded-md bg-muted/40 space-y-1.5" data-testid={`board-entry-${col.key}-${idx}`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold truncate max-w-[180px]">{entry.entityName}</span>
                          <DiagnosisBadge diagnosis={entry.scoring.diagnosis} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ActionBadge action={entry.scoring.recommendedAction} />
                          <BenchmarkInfo scoring={entry.scoring} />
                        </div>
                        {entry.listingReason && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed" data-testid={`text-listing-reason-${col.key}-${idx}`}>
                            {entry.listingReason}
                          </p>
                        )}
                        {(entry.spend != null || entry.roas != null) && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {entry.spend != null && <span>花費: {formatCurrency(entry.spend)}</span>}
                            {entry.roas != null && <span>ROAS: {entry.roas.toFixed(2)}</span>}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** 漏斗診斷警告（階段四 FB-GA4 縫合） */
interface FunnelWarningItem {
  productName: string;
  type: "landing_page_break" | "checkout_resistance";
  message: string;
}

/** 分數說明：可點擊展開定義、計算來源、門檻、顏色、對應動作 */
function ScoreDefinitionsTrigger() {
  const { data } = useQuery<{ definitions: Array<{ key: string; name: string; definition: string; calculationSource: string; thresholds: string; colorRule: string; suggestedAction: string }> }>({
    queryKey: ["/api/scoring/definitions"],
    queryFn: async () => {
      const res = await fetch("/api/scoring/definitions", { credentials: "include" });
      if (!res.ok) return { definitions: [] };
      return res.json();
    },
  });
  const definitions = data?.definitions ?? [];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
          <BarChart3 className="w-3.5 h-3.5" />
          分數怎麼算？
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>分數定義與門檻</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {definitions.map((d) => (
            <div key={d.key} className="rounded-lg border p-3 space-y-1">
              <p className="font-medium text-foreground">{d.name}</p>
              <p className="text-muted-foreground">{d.definition}</p>
              <p className="text-xs"><span className="font-medium">計算來源：</span>{d.calculationSource}</p>
              <p className="text-xs"><span className="font-medium">門檻：</span>{d.thresholds}</p>
              <p className="text-xs"><span className="font-medium">顏色：</span>{d.colorRule}</p>
              <p className="text-xs text-primary"><span className="font-medium">建議動作：</span>{d.suggestedAction}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 預算動作列（活動維度） */
interface BudgetActionRow {
  campaignId: string;
  campaignName: string;
  accountId: string;
  productName: string;
  spend: number;
  roas: number;
  impactAmount: number;
  sampleStatus: string;
  scaleReadinessScore?: number;
  profitHeadroom?: number;
  trendABC: string | null;
  suggestedAction: string;
  suggestedPct: number | "關閉";
  reason: string;
  whyNotMore?: string;
}

/** Action Center API 回傳格式 */
interface ActionCenterData {
  productLevel: Array<{ productName: string; spend: number; revenue: number; roas: number; campaignCount: number }>;
  creativeLeaderboard: Array<{
    productName: string;
    materialStrategy: string;
    headlineSnippet: string;
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
    cpa: number;
    thumbnailUrl?: string;
    budgetSuggestion?: string;
    scaleReadinessScore?: number;
    creativeEdge?: number;
    suggestedAction?: string;
    suggestedPct?: number | "關閉";
    budgetReason?: string;
    whyNotMore?: string;
  }>;
  hiddenGems: Array<{ productName: string; spend: number; revenue: number; roas: number; message: string }>;
  urgentStop: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; message: string }>;
  riskyCampaigns: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; revenue: number; suggestion: string }>;
  funnelWarnings?: FunnelWarningItem[];
  failureRatesByTag?: Record<string, number>;
  budgetActionTable?: BudgetActionRow[];
  tableRescue?: BudgetActionRow[];
  tableScaleUp?: BudgetActionRow[];
  tableNoMisjudge?: BudgetActionRow[];
  tableExtend?: Array<{ productName: string; materialStrategy: string; headlineSnippet: string; spend: number; revenue: number; roas: number; conversions: number; creativeEdge?: number; scaleReadinessScore?: number; [k: string]: unknown }>;
  tierMainAccount?: Array<{ productName: string; spend: number; revenue: number; roas: number }>;
  tierHighPotentialCreatives?: Array<{ productName: string; materialStrategy: string; headlineSnippet: string; spend: number; revenue: number; roas: number }>;
  tierNoise?: Array<{ campaignId: string; campaignName: string; productName: string; spend: number; reason: string }>;
}

export default function DashboardPage() {
  const scope = useAppScope();
  const { toast } = useToast();
  const { employee, employees, setEmployeeById } = useEmployee();
  const autoRefreshed = useRef(false);

  const actionCenterParams = new URLSearchParams();
  if (employee.assignedProducts?.length) actionCenterParams.set("scopeProducts", employee.assignedProducts.join(","));
  if (employee.assignedAccounts?.length) actionCenterParams.set("scopeAccountIds", employee.assignedAccounts.join(","));
  const actionCenterQueryKey = ["/api/dashboard/action-center", actionCenterParams.toString()];

  const { data: actionData } = useQuery<ActionCenterData>({
    queryKey: actionCenterQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/action-center?${actionCenterParams.toString()}`, { credentials: "include" });
      if (!res.ok) return { productLevel: [], creativeLeaderboard: [], hiddenGems: [], urgentStop: [], riskyCampaigns: [], funnelWarnings: [], failureRatesByTag: {}, budgetActionTable: [] };
      return res.json();
    },
  });

  const { data: workbenchTasks = [] } = useQuery({
    queryKey: ["/api/workbench/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/workbench/tasks", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const unassignedTaskCount = workbenchTasks.filter((t: { status: string }) => t.status === "unassigned" || t.status === "assigned").length;

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ hasSummary: boolean; summary?: CrossAccountSummary; dataStatus?: "no_sync" | "synced_no_data" | "has_data"; message?: string }>({
    queryKey: ["/api/dashboard/cross-account-summary"],
  });

  const { data: rankingData, isLoading: rankingLoading } = useQuery<{ accounts: AccountHealthScore[] }>({
    queryKey: ["/api/dashboard/account-ranking"],
  });

  const { data: anomalyData, isLoading: anomalyLoading } = useQuery<{ anomalies: Anomaly[] }>({
    queryKey: ["/api/dashboard/anomaly-summary"],
  });

  const { data: refreshStatusData } = useQuery<RefreshStatus>({
    queryKey: ["/api/refresh/status"],
    refetchInterval: (query) => {
      const data = query.state.data as RefreshStatus | undefined;
      return data?.isRefreshing ? 2000 : false;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const body = scope.buildRefreshBody();
      const res = await apiRequest("POST", "/api/refresh", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refresh/status"] });
    },
    onError: (err: any) => {
      toast({ title: "資料更新失敗", description: err.message || "請稍後再試", variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (opts?: { runRefreshAfterSync?: boolean }) => {
      const res = await apiRequest("POST", "/api/accounts/sync", {});
      return res.json();
    },
    onSuccess: (data: any, variables?: { runRefreshAfterSync?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/synced"] });
      const count = data.syncedAccounts?.length || 0;
      toast({ title: "帳號同步完成", description: `已同步 ${count} 個帳號` });
      if (variables?.runRefreshAfterSync) {
        refreshMutation.mutate();
      }
    },
    onError: () => {
      toast({ title: "帳號同步失敗", variant: "destructive" });
    },
  });

  const summary = summaryData?.summary;
  const hasSummary = summaryData?.hasSummary;
  const accounts = rankingData?.accounts || [];
  const anomalies = anomalyData?.anomalies || [];
  const isRefreshing = refreshMutation.isPending || refreshStatusData?.isRefreshing;

  const wasRefreshing = useRef(false);

  useEffect(() => {
    if (autoRefreshed.current) return;
    if (summaryLoading) return;
    if (!hasSummary && !isRefreshing) {
      autoRefreshed.current = true;
      refreshMutation.mutate();
    }
  }, [summaryLoading, hasSummary, isRefreshing]);

  useEffect(() => {
    if (wasRefreshing.current && !refreshStatusData?.isRefreshing) {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/cross-account-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/account-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/anomaly-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/ai-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/action-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/opportunities"] });
      if (refreshStatusData?.currentStep === "完成") {
        toast({ title: "資料更新完成", description: "所有帳號的數據已重新分析" });
      }
    }
    wasRefreshing.current = !!refreshStatusData?.isRefreshing;
  }, [refreshStatusData?.isRefreshing]);

  const riskyCampaigns = summary?.riskyCampaigns || [];
  const scaleOpportunities = summary?.scaleOpportunities || [];
  const allRisky = [...riskyCampaigns, ...scaleOpportunities];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "早安";
    if (h < 18) return "午安";
    return "晚安";
  })();

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <h1 className="page-title" data-testid="text-page-title">
            今日決策中心
          </h1>
          <Select value={employee.id} onValueChange={setEmployeeById} data-testid="select-mock-employee">
            <SelectTrigger className="w-[220px] border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/30">
              <SelectValue placeholder="模擬登入者" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  [{getDepartmentLabel(emp.department)}] {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {refreshStatusData?.lastRefreshedAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-last-refreshed">
              <Clock className="w-3 h-3" />
              資料更新: {formatTimestamp(refreshStatusData.lastRefreshedAt)}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              syncMutation.mutate({ runRefreshAfterSync: true });
            }}
            disabled={!!isRefreshing}
            className="gap-2"
            data-testid="button-refresh"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            {isRefreshing ? (refreshStatusData?.currentStep || "更新中...") : "更新資料"}
          </Button>

          <DateRangeSelector value={scope.dateDisplayValue} onChange={scope.handleDateChange} />
        </div>
      </header>

      <div className="min-h-full p-4 md:p-6 space-y-6 page-container-fluid">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-medium">
              {greeting}！<span className="text-primary">{employee.name}</span>
              。30 秒掌握今日重點，下方可切換角色視角。
            </p>
            <ScoreDefinitionsTrigger />
          </CardContent>
        </Card>

        {actionData?.productLevel && actionData.productLevel.length > 0 && (
          <Card className="border-muted" data-testid="card-today-kpi">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <span>總花費 <strong className="text-lg">{formatCurrency(actionData.productLevel.reduce((s, p) => s + p.spend, 0))}</strong></span>
                <span>營收 <strong className="text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(actionData.productLevel.reduce((s, p) => s + p.revenue, 0))}</strong></span>
                <span>ROAS <strong className="text-lg">{(actionData.productLevel.reduce((s, p) => s + p.revenue, 0) / Math.max(1, actionData.productLevel.reduce((s, p) => s + p.spend, 0))).toFixed(2)}</strong></span>
                <span>利潤估算 <strong className="text-lg">{formatCurrency(actionData.productLevel.reduce((s, p) => s + p.revenue - p.spend, 0))}</strong></span>
              </div>
            </CardContent>
          </Card>
        )}

        {actionData?.productLevel && actionData.productLevel.length > 0 && (
          <>
            <h2 className="text-base font-semibold text-foreground">決策焦點 · 優先回答四問</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="section-today-focus">
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="pt-3 pb-3">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> 1. 今天誰在賺錢</h4>
                <ul className="space-y-1">
                  {[...actionData.productLevel].filter((p) => p.roas >= 1).sort((a, b) => b.roas - a.roas).slice(0, 3).map((p) => (
                    <li key={p.productName} className="flex justify-between text-sm">
                      <Link href="/products" className="font-medium hover:underline">{p.productName}</Link>
                      <span className="text-emerald-600">ROAS {p.roas.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                {actionData.productLevel.filter((p) => p.roas >= 1).length === 0 && <p className="text-xs text-muted-foreground">尚無</p>}
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="pt-3 pb-3">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> 2. 今天誰最危險</h4>
                <ul className="space-y-1">
                  {[...actionData.productLevel].filter((p) => p.spend > 0 && (p.revenue <= 0 || p.roas < 1)).sort((a, b) => b.spend - a.spend).slice(0, 3).map((p) => (
                    <li key={p.productName} className="flex justify-between text-sm">
                      <Link href="/products" className="font-medium hover:underline">{p.productName}</Link>
                      <span className="text-red-600">花費 {formatCurrency(p.spend)}</span>
                    </li>
                  ))}
                </ul>
                {actionData.productLevel.filter((p) => p.spend > 0 && (p.revenue <= 0 || p.roas < 1)).length === 0 && <p className="text-xs text-muted-foreground">尚無</p>}
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="pt-3 pb-3">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> 3. 今天誰最值得放大</h4>
                {actionData.creativeLeaderboard && actionData.creativeLeaderboard.length > 0 ? (
                  <ul className="space-y-1">
                    {[...actionData.creativeLeaderboard]
                      .filter((c) => (c as { materialTier?: string }).materialTier === "Winner" || (c as { materialTier?: string }).materialTier === "Potential")
                      .sort((a, b) => b.revenue - a.revenue || b.roas - a.roas)
                      .slice(0, 5)
                      .map((c, i) => (
                        <li key={`${c.productName}-${c.materialStrategy}-${c.headlineSnippet}-${i}`} className="text-sm truncate">
                          <Link href="/products" className="hover:underline">{c.productName}</Link> · {c.materialStrategy}+{c.headlineSnippet} <span className="text-emerald-600">ROAS {c.roas.toFixed(2)}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">尚無達標贏家/潛力股</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> 4. 今天先做哪 3 件事</h4>
                <p className="text-sm">
                  高優先級警報 <strong>{(actionData?.funnelWarnings?.length ?? 0) + (actionData?.urgentStop?.length ?? 0)}</strong> 則
                  {((actionData?.funnelWarnings?.length ?? 0) + (actionData?.urgentStop?.length ?? 0)) > 0 && (
                    <Link href="/" className="ml-1 text-primary hover:underline">查看</Link>
                  )}
                </p>
                <ul className="text-sm space-y-1 mt-1">
                  {(actionData?.riskyCampaigns?.length ?? 0) > 0 && (
                    <li><Link href="/products" className="text-primary hover:underline">1. 處理危險活動 ({actionData!.riskyCampaigns!.length} 則)</Link></li>
                  )}
                  {(actionData?.funnelWarnings?.length ?? 0) + (actionData?.urgentStop?.length ?? 0) > 0 && (
                    <li><Link href="/" className="text-primary hover:underline">2. 查看警報與止血建議</Link></li>
                  )}
                  {unassignedTaskCount > 0 && (
                    <li><Link href="/tasks" className="text-primary hover:underline">3. 前往任務中心 ({unassignedTaskCount} 則待分配)</Link></li>
                  )}
                </ul>
                {((actionData?.riskyCampaigns?.length ?? 0) === 0 && (actionData?.funnelWarnings?.length ?? 0) + (actionData?.urgentStop?.length ?? 0) === 0 && unassignedTaskCount === 0) && (
                  <p className="text-xs text-muted-foreground mt-1">暫無優先事項，可查看下方報表</p>
                )}
              </CardContent>
            </Card>
          </div>
          </>
        )}

        {(employee.department === "ADMIN" || employee.department === "MARKETING") && actionData?.funnelWarnings && actionData.funnelWarnings.length > 0 && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30">
            <CardContent className="pt-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                漏斗診斷
              </h3>
              <ul className="space-y-2 text-sm">
                {actionData.funnelWarnings.map((w, i) => (
                  <li
                    key={`${w.productName}-${w.type}-${i}`}
                    className={cn(
                      "rounded-md px-3 py-2 border",
                      w.type === "landing_page_break"
                        ? "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                        : "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
                    )}
                  >
                    {w.message}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {((actionData?.tableRescue?.length ?? 0) + (actionData?.tableScaleUp?.length ?? 0) + (actionData?.tableNoMisjudge?.length ?? 0) + (actionData?.tableExtend?.length ?? 0)) > 0 && (
          <>
            {actionData?.tableRescue && actionData.tableRescue.length > 0 && (
              <Card data-testid="card-table-rescue" className="border-red-200 dark:border-red-800">
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    今日先救
                  </h3>
                  <div className="overflow-x-auto text-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">活動／商品</th>
                          <th className="text-right p-2">花費</th>
                          <th className="text-right p-2">ROAS</th>
                          <th className="text-center p-2">建議幅度</th>
                          <th className="text-left p-2 max-w-[220px]">原因</th>
                          <th className="text-left p-2 max-w-[220px]">為什麼不是更大或更小</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionData.tableRescue.map((r) => (
                          <tr key={r.campaignId} className="border-b border-muted/50">
                            <td className="p-2 truncate max-w-[180px]" title={r.campaignName}>{r.productName} · {r.campaignName}</td>
                            <td className="text-right p-2">{formatCurrency(r.spend)}</td>
                            <td className="text-right p-2">{r.roas.toFixed(2)}</td>
                            <td className="text-center p-2 font-medium">{r.suggestedPct === "關閉" ? "關閉" : `${r.suggestedPct}%`}</td>
                            <td className="p-2 text-muted-foreground text-xs max-w-[220px]" title={r.reason}>{r.reason}</td>
                            <td className="p-2 text-muted-foreground text-xs max-w-[220px]" title={r.whyNotMore ?? ""}>{r.whyNotMore ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            {actionData?.tableScaleUp && actionData.tableScaleUp.length > 0 && (
              <Card data-testid="card-table-scale-up" className="border-emerald-200 dark:border-emerald-800">
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <Rocket className="w-4 h-4" />
                    今日可加碼
                  </h3>
                  <div className="overflow-x-auto text-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">活動／商品</th>
                          <th className="text-right p-2">花費</th>
                          <th className="text-right p-2">ROAS</th>
                          <th className="text-center p-2">建議幅度</th>
                          <th className="text-left p-2 max-w-[220px]">原因</th>
                          <th className="text-left p-2 max-w-[220px]">為什麼不是更大或更小</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionData.tableScaleUp.map((r) => (
                          <tr key={r.campaignId} className="border-b border-muted/50">
                            <td className="p-2 truncate max-w-[180px]" title={r.campaignName}>{r.productName} · {r.campaignName}</td>
                            <td className="text-right p-2">{formatCurrency(r.spend)}</td>
                            <td className="text-right p-2">{r.roas.toFixed(2)}</td>
                            <td className="text-center p-2 font-medium">
                              {r.suggestedPct === "關閉" ? "關閉" : (r.suggestedPct as number) > 0 ? `+${r.suggestedPct}%` : `${r.suggestedPct}%`}
                            </td>
                            <td className="p-2 text-muted-foreground text-xs max-w-[220px]" title={r.reason}>{r.reason}</td>
                            <td className="p-2 text-muted-foreground text-xs max-w-[220px]" title={r.whyNotMore ?? ""}>{r.whyNotMore ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            {actionData?.tableNoMisjudge && actionData.tableNoMisjudge.length > 0 && (
              <Card data-testid="card-table-no-misjudge" className="border-amber-200 dark:border-amber-800">
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Shield className="w-4 h-4" />
                    今日不要誤判
                  </h3>
                  <div className="overflow-x-auto text-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">活動／商品</th>
                          <th className="text-right p-2">花費</th>
                          <th className="text-right p-2">ROAS</th>
                          <th className="text-left p-2 max-w-[220px]">原因</th>
                          <th className="text-left p-2 max-w-[220px]">為什麼不是更大或更小</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionData.tableNoMisjudge.map((r) => (
                          <tr key={r.campaignId} className="border-b border-muted/50">
                            <td className="p-2 truncate max-w-[180px]" title={r.campaignName}>{r.productName} · {r.campaignName}</td>
                            <td className="text-right p-2">{formatCurrency(r.spend)}</td>
                            <td className="text-right p-2">{r.roas.toFixed(2)}</td>
                            <td className="p-2 text-muted-foreground text-xs max-w-[220px]" title={r.reason}>{r.reason}</td>
                            <td className="p-2 text-muted-foreground text-xs max-w-[220px]" title={r.whyNotMore ?? ""}>{r.whyNotMore ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            {actionData?.tableExtend && actionData.tableExtend.length > 0 && (
              <Card data-testid="card-table-extend" className="border-violet-200 dark:border-violet-800">
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-violet-700 dark:text-violet-400">
                    <Zap className="w-4 h-4" />
                    今日值得延伸
                  </h3>
                  <div className="overflow-x-auto text-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">商品／素材</th>
                          <th className="text-right p-2">花費</th>
                          <th className="text-right p-2">營收</th>
                          <th className="text-right p-2">ROAS</th>
                          <th className="text-right p-2">Creative Edge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionData.tableExtend.map((c, i) => (
                          <tr key={`${c.productName}-${c.materialStrategy}-${c.headlineSnippet}-${i}`} className="border-b border-muted/50">
                            <td className="p-2 truncate max-w-[200px]" title={`${c.productName} · ${c.materialStrategy} · ${c.headlineSnippet}`}>
                              {c.productName} · {c.materialStrategy}
                            </td>
                            <td className="text-right p-2">{formatCurrency(c.spend)}</td>
                            <td className="text-right p-2">{formatCurrency(c.revenue)}</td>
                            <td className="text-right p-2">{c.roas.toFixed(2)}</td>
                            <td className="text-right p-2">{(c.creativeEdge ?? 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {actionData?.productLevel && actionData.productLevel.length > 0 && (
          <ProductRedBlackBoard productLevel={actionData.productLevel} />
        )}
        {actionData?.creativeLeaderboard && actionData.creativeLeaderboard.length > 0 && (
          <>
            <CreativeLeaderboardHero
              creativeLeaderboard={actionData.creativeLeaderboard}
              failureRatesByTag={actionData.failureRatesByTag}
              department={employee.department}
            />
            <CreativeBlacklistSection
              creativeLeaderboard={actionData.creativeLeaderboard}
              failureRatesByTag={actionData.failureRatesByTag}
            />
          </>
        )}

        {employee.department === "ADMIN" && hasSummary && summary && (
          <>
            <HeroSummaryCard summary={summary} isLoading={summaryLoading} />
            <TopPriorityAccountsSection accounts={summary.topPriorityAccounts || []} isLoading={summaryLoading} />
            <AccountRankingTable accounts={accounts} isLoading={rankingLoading} />
            <OpportunitySummaryCard />
            {allRisky.length > 0 && <RiskyCampaignsSection campaigns={allRisky} isLoading={summaryLoading} />}
            <AnomalySummarySection anomalies={anomalies} isLoading={anomalyLoading} />
            <BoardsSection />
            <AIRecommendationsSection summary={summary} isLoading={summaryLoading} />
          </>
        )}

        {employee.department === "ADMIN" && actionData && actionData.productLevel.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-semibold mb-3">全公司商品排行榜</h3>
              <div className="table-scroll-container rounded-md border">
                <table className="w-full text-sm min-w-[32rem]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2">商品</th>
                      <th className="text-right p-2">總花費</th>
                      <th className="text-right p-2">ROAS</th>
                      <th className="text-right p-2">Campaign 數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionData.productLevel.map((p) => (
                      <tr key={p.productName} className="border-t">
                        <td className="p-2 font-medium">{p.productName}</td>
                        <td className="p-2 text-right">{formatCurrency(p.spend)}</td>
                        <td className="p-2 text-right">{p.roas.toFixed(2)}</td>
                        <td className="p-2 text-right">{p.campaignCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {employee.department === "AD" && (
          <>
            {actionData?.urgentStop && actionData.urgentStop.length > 0 && (
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="pt-4">
                  <h3 className="font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    急需止血
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {actionData.urgentStop.map((u) => (
                      <li key={u.campaignId}>
                        {u.campaignName} — {formatCurrency(u.spend)}，{u.message}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {actionData?.hiddenGems && actionData.hiddenGems.length > 0 && (
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardContent className="pt-4">
                  <h3 className="font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <Rocket className="w-4 h-4" />
                    強烈建議擴量
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {actionData.hiddenGems.map((g) => (
                      <li key={g.productName}>
                        <strong>{g.productName}</strong> — ROAS {g.roas.toFixed(2)}，{g.message}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {actionData?.riskyCampaigns && actionData.riskyCampaigns.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-2">預算建議</h3>
                  <ul className="space-y-1 text-sm">
                    {actionData.riskyCampaigns.map((r) => (
                      <li key={r.campaignId}>
                        {r.campaignName} — {r.suggestion}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {employee.department === "MARKETING" && actionData?.creativeLeaderboard && actionData.creativeLeaderboard.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-semibold mb-3">文案勝率榜</h3>
              <div className="space-y-4">
                {(() => {
                  const byProduct = new Map<string, typeof actionData.creativeLeaderboard>();
                  for (const row of actionData.creativeLeaderboard) {
                    if (!byProduct.has(row.productName)) byProduct.set(row.productName, []);
                    byProduct.get(row.productName)!.push(row);
                  }
                  return Array.from(byProduct.entries()).map(([productName, rows]) => (
                    <div key={productName}>
                      <p className="font-medium text-muted-foreground mb-2">{productName}</p>
                      <ul className="space-y-1 text-sm">
                        {rows
                          .sort((a, b) => b.roas - a.roas)
                          .map((r) => (
                            <li key={`${r.materialStrategy}-${r.headlineSnippet}`}>
                              【{r.headlineSnippet}】ROAS {r.roas.toFixed(2)} · CPA {r.cpa > 0 ? formatCurrency(r.cpa) : "—"}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {employee.department === "DESIGN" && actionData?.creativeLeaderboard && actionData.creativeLeaderboard.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-semibold mb-3">素材金榜（依素材策略）</h3>
              <p className="text-sm text-muted-foreground mb-3">僅顯示素材策略與表現維度，不顯示花費與營收。</p>
              <div className="space-y-4">
                {(() => {
                  const byProduct = new Map<string, typeof actionData.creativeLeaderboard>();
                  for (const row of actionData.creativeLeaderboard) {
                    if (!byProduct.has(row.productName)) byProduct.set(row.productName, []);
                    byProduct.get(row.productName)!.push(row);
                  }
                  return Array.from(byProduct.entries()).map(([productName, rows]) => (
                    <div key={productName}>
                      <p className="font-medium text-muted-foreground mb-2">{productName}</p>
                      <ul className="space-y-1 text-sm">
                        {rows
                          .sort((a, b) => b.conversions - a.conversions)
                          .map((r) => (
                            <li key={`${r.materialStrategy}-${r.headlineSnippet}`}>
                              【{r.materialStrategy}】{r.headlineSnippet} — 轉換數 {r.conversions}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {actionData?.productLevel && actionData.productLevel.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-semibold mb-3">負責商品排行榜</h3>
              <div className="space-y-2">
                {actionData.productLevel.map((p) => (
                  <Collapsible key={p.productName}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        <span>{p.productName}</span>
                        {employee.department !== "DESIGN" && (
                          <span className="text-muted-foreground text-sm">
                            {formatCurrency(p.spend)} · ROAS {p.roas.toFixed(2)}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-2 pt-1 pb-2 text-sm border-l ml-2 space-y-1">
                        {actionData.creativeLeaderboard
                          ?.filter((c) => c.productName === p.productName)
                          .map((c) => (
                            <div key={`${c.materialStrategy}-${c.headlineSnippet}`}>
                              {c.materialStrategy} + {c.headlineSnippet}
                              {employee.department !== "DESIGN" && ` · ROAS ${c.roas.toFixed(2)}`}
                            </div>
                          )) ?? null}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!hasSummary && employee.department === "ADMIN" && (
          <EmptyStateCard dataStatus={summaryData?.dataStatus} message={summaryData?.message} />
        )}
        {(employee.department === "AD" || employee.department === "MARKETING" || employee.department === "DESIGN") &&
          (!actionData || (actionData.productLevel.length === 0 && actionData.creativeLeaderboard.length === 0)) && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              尚無您負責範圍內的數據，請先更新資料或確認負責帳號／商品設定。
            </CardContent>
          </Card>
        )}
        <QuickStartSection />
      </div>
    </div>
  );
}
