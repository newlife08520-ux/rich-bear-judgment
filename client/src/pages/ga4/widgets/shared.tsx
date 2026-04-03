import { ArrowUp, ArrowDown, AlertTriangle, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OpportunityScoreBadge } from "@/components/shared/score-badge";
import { SeverityBadge } from "@/components/shared/severity-badge";
import type { RiskLevel, HighRiskItem, PageRecommendation } from "@shared/schema";
import type { TriScore } from "@shared/schema";
import { priorityColors, priorityLabels } from "../ga4-types";

const riskLevelLabels: Record<RiskLevel, string> = {
  danger: "危險",
  warning: "警告",
  watch: "觀察",
  stable: "穩定",
  potential: "潛力",
};

const riskLevelStyles: Record<RiskLevel, string> = {
  danger: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  watch: "bg-yellow-100 text-yellow-700",
  stable: "bg-green-100 text-green-700",
  potential: "bg-blue-100 text-blue-700",
};

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge
      variant="secondary"
      className={`no-default-hover-elevate no-default-active-elevate ${riskLevelStyles[level]}`}
      data-testid={`badge-risk-${level}`}
    >
      {riskLevelLabels[level]}
    </Badge>
  );
}

export function TriScoreDisplay({ triScore }: { triScore: TriScore }) {
  const items = [
    { label: "健康", value: triScore.health },
    { label: "急迫", value: triScore.urgency },
    { label: "潛力", value: triScore.scalePotential },
  ];
  return (
    <div className="flex items-center gap-2" data-testid="display-tri-score">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-0.5">
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                strokeWidth="3"
                strokeDasharray={`${(item.value / 100) * 94.2} 94.2`}
                strokeLinecap="round"
                className={
                  item.value >= 70 ? "text-emerald-500" : item.value >= 40 ? "text-amber-500" : "text-red-500"
                }
                stroke="currentColor"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{item.value}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function PageRecommendationCard({ recommendation }: { recommendation: PageRecommendation }) {
  const borderColor =
    recommendation.priority === "high"
      ? "border-red-200 dark:border-red-800"
      : recommendation.priority === "medium"
        ? "border-amber-200 dark:border-amber-800"
        : "border-green-200 dark:border-green-800";

  return (
    <div className="p-3" data-testid="card-page-recommendation">
      <Card className={`${borderColor}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${
                recommendation.priority === "high"
                  ? "text-red-500"
                  : recommendation.priority === "medium"
                    ? "text-amber-500"
                    : "text-green-500"
              }`}
            />
            <span className="text-sm font-semibold">{recommendation.diagnosis}</span>
            <Badge
              variant="secondary"
              className={`no-default-hover-elevate no-default-active-elevate ${priorityColors[recommendation.priority]}`}
              data-testid="badge-priority"
            >
              {priorityLabels[recommendation.priority]}
            </Badge>
            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs" data-testid="badge-affected-stage">
              {recommendation.affectedStage}
            </Badge>
            <span className="text-xs text-muted-foreground">信心度 {recommendation.confidence}%</span>
          </div>
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed" data-testid="text-recommendation-action">
              {recommendation.action}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ChangeIndicator({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (previous === 0) return null;
  const change = current - previous;
  const isGood = inverse ? change < 0 : change > 0;
  const absChange = Math.abs(change);
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? "text-emerald-600" : "text-red-600"}`}>
      {isGood ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {absChange.toFixed(1)}
    </span>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-64" />
    </div>
  );
}

export function HighRiskSection({ items, isLoading }: { items?: HighRiskItem[]; isLoading: boolean }) {
  const ga4Items = items?.filter((i) => i.type === "page") || [];

  if (isLoading) {
    return (
      <Card data-testid="card-high-risk">
        <CardContent className="p-5">
          <Skeleton className="h-5 w-40 mb-3" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (ga4Items.length === 0) return null;

  return (
    <Card data-testid="card-high-risk">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="section-title">這些頁面需要特別關注</h3>
          <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
            {ga4Items.length}
          </Badge>
        </div>
        <div className="space-y-3">
          {ga4Items.map((item) => (
            <div key={item.id} className="p-3 rounded-md bg-muted/30 space-y-2" data-testid={`high-risk-item-${item.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{item.name}</span>
                  <SeverityBadge severity={item.severity} />
                </div>
                <OpportunityScoreBadge score={item.opportunityScore} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.problemTags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.aiVerdict}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
