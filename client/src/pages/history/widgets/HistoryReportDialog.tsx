import {
  Scale,
  Download,
  AlertTriangle,
  CheckCircle,
  Target,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { JudgmentReport } from "@shared/schema";
import {
  judgmentTypeLabels,
  judgmentObjectives,
  gradeLabels,
  recommendationLabels,
  recommendationColors,
} from "@shared/schema";
import { OpportunityScoreBadge } from "@/components/shared/score-badge";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { historyTypeColors } from "../history-types";

export function HistoryReportDialog({
  open,
  onOpenChange,
  selectedReport,
  dialogTab,
  onDialogTab,
  exportingPdf,
  onExportPdf,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selectedReport: JudgmentReport | null;
  dialogTab: string;
  onDialogTab: (t: string) => void;
  exportingPdf: boolean;
  onExportPdf: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 font-display flex-wrap">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              審判報告詳情
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPdf}
              disabled={exportingPdf}
              data-testid="button-export-pdf"
            >
              {exportingPdf ? (
                <span className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mr-1.5" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              匯出 PDF
            </Button>
          </DialogTitle>
        </DialogHeader>
        {selectedReport && (
          <div className="flex flex-col" style={{ maxHeight: "calc(85vh - 100px)" }}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="outline" className={historyTypeColors[selectedReport.type]}>
                {judgmentTypeLabels[selectedReport.type]}
              </Badge>
              {selectedReport.summary.opportunityScore !== undefined && (
                <OpportunityScoreBadge score={selectedReport.summary.opportunityScore} size="md" />
              )}
              <span className="text-xs text-muted-foreground">
                {judgmentObjectives[selectedReport.type]?.find((o) => o.id === selectedReport.input.objective)?.label}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                Case: {selectedReport.caseId} v{selectedReport.version}
              </span>
            </div>

            <Tabs value={dialogTab} onValueChange={onDialogTab}>
              <TabsList className="mb-3" data-testid="tabs-dialog-report">
                <TabsTrigger value="summary">決策摘要</TabsTrigger>
                <TabsTrigger value="detail">深度分析</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1" style={{ maxHeight: "calc(85vh - 200px)" }}>
                <TabsContent value="summary" className="mt-0">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="text-center">
                        <div
                          className="text-4xl font-display font-bold"
                          style={{
                            color:
                              selectedReport.summary.score >= 70
                                ? "#22c55e"
                                : selectedReport.summary.score >= 40
                                  ? "#eab308"
                                  : "#ef4444",
                          }}
                          data-testid="text-dialog-score"
                        >
                          {selectedReport.summary.score}
                        </div>
                        <Badge variant="outline" className="text-xs mt-1">
                          {selectedReport.summary.grade} - {gradeLabels[selectedReport.summary.grade]}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-relaxed">{selectedReport.summary.verdict}</p>
                      </div>
                    </div>

                    <div
                      className={`rounded-lg border p-3 ${recommendationColors[selectedReport.summary.recommendation]}`}
                    >
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        <span className="font-semibold text-sm">
                          {recommendationLabels[selectedReport.summary.recommendation]}
                        </span>
                      </div>
                      <p className="text-xs mt-1 opacity-80">{selectedReport.summary.recommendationNote}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        重大問題
                      </h4>
                      <div className="space-y-2">
                        {selectedReport.summary.topIssues.map((issue, i) => (
                          <div key={i} className="p-3 rounded-md bg-red-500/[0.04] border border-red-500/10">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{issue.title}</span>
                              <SeverityBadge severity={issue.severity} />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4
                        className="text-sm font-semibold text-emerald-600 mb-2 flex items-center gap-1.5"
                        data-testid="text-priority-actions-title"
                      >
                        <CheckCircle className="w-4 h-4" />
                        先做這 3 件事
                      </h4>
                      <div className="space-y-1.5">
                        {selectedReport.summary.priorityActions.map((action, i) => {
                          const impactColors: Record<string, string> = {
                            high: "text-red-700 bg-red-50",
                            medium: "text-amber-700 bg-amber-50",
                            low: "text-blue-700 bg-blue-50",
                          };
                          const impactLabels: Record<string, string> = {
                            high: "高影響",
                            medium: "中影響",
                            low: "低影響",
                          };
                          return (
                            <div
                              key={i}
                              className="flex items-start gap-2 p-2 rounded-md bg-emerald-500/[0.04] border border-emerald-500/10"
                              data-testid={`card-priority-action-${i}`}
                            >
                              <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                {action.order}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium">{action.action}</span>
                                {action.reason && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{action.reason}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {action.opportunityScore !== undefined && (
                                  <OpportunityScoreBadge score={action.opportunityScore} />
                                )}
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${impactColors[action.impact] || ""}`}
                                >
                                  {impactLabels[action.impact] || action.impact}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="detail" className="mt-0">
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-muted/50 text-sm leading-relaxed">
                      <h4 className="font-semibold text-sm mb-2">AI 判斷邏輯</h4>
                      {selectedReport.detail.reasoning}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">五維診斷</h4>
                      {Object.entries(selectedReport.detail.diagnosis).map(([key, dim]) => {
                        const d = dim as { score: number; analysis: string };
                        const scoreColor =
                          d.score >= 70 ? "text-emerald-700" : d.score >= 40 ? "text-amber-700" : "text-red-700";
                        return (
                          <div key={key} className="p-2 border-b last:border-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{key}</span>
                              <span className={`text-sm font-bold ${scoreColor}`}>{d.score}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{d.analysis}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">執行建議</h4>
                      <ul className="space-y-1">
                        {selectedReport.detail.executionSuggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
