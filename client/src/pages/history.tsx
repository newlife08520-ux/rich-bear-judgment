import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  History,
  ChevronRight,
  Scale,
  Clock,
  Search,
  Image,
  Globe,
  Megaphone,
  TrendingDown,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  Target,
  ArrowRight,
  FileText,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  JudgmentRecord,
  JudgmentReport,
  JudgmentType,
  ReportGrade,
  RecommendationLevel,
  ReviewSession,
} from "@shared/schema";
import {
  judgmentTypeLabels,
  judgmentObjectives,
  gradeLabels,
  recommendationLabels,
  recommendationColors,
} from "@shared/schema";
import { OpportunityScoreBadge } from "@/components/shared/score-badge";
import { RecommendationLevelBadge } from "@/components/shared/recommendation-badge";
import { SeverityBadge } from "@/components/shared/severity-badge";

const typeIcons: Record<JudgmentType, any> = {
  creative: Image,
  landing_page: Globe,
  fb_ads: Megaphone,
  ga4_funnel: TrendingDown,
};

const typeColors: Record<JudgmentType, string> = {
  creative: "text-violet-700 bg-violet-50 border-violet-200",
  landing_page: "text-blue-700 bg-blue-50 border-blue-200",
  fb_ads: "text-amber-700 bg-amber-50 border-amber-200",
  ga4_funnel: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

const typeIconBg: Record<JudgmentType, string> = {
  creative: "bg-violet-100 text-violet-600",
  landing_page: "bg-blue-100 text-blue-600",
  fb_ads: "bg-amber-100 text-amber-600",
  ga4_funnel: "bg-emerald-100 text-emerald-600",
};

function HistoryScoreBadge({ score, grade }: { score: number; grade: ReportGrade }) {
  const color =
    score >= 70
      ? "text-emerald-600 bg-emerald-500/10"
      : score >= 40
      ? "text-amber-600 bg-amber-500/10"
      : "text-red-600 bg-red-500/10";
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="secondary" className={`${color} font-display text-sm font-bold tabular-nums`}>
        {score}
      </Badge>
      <span className="text-xs text-muted-foreground">{grade}</span>
    </div>
  );
}


async function generatePdf(report: JudgmentReport) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 20;

  const addPage = () => {
    doc.addPage();
    y = 20;
  };

  const checkPage = (needed: number) => {
    if (y + needed > 270) addPage();
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AI Marketing Judgment Report", marginL, y);
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const typeName = judgmentTypeLabels[report.type] || report.type;
  doc.text(`Type: ${typeName}`, marginL, y);
  doc.text(`Case: ${report.caseId} v${report.version}`, pageW - marginR, y, { align: "right" });
  y += 5;
  doc.text(`Date: ${new Date(report.createdAt).toLocaleString()}`, marginL, y);
  y += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  const scoreColor =
    report.summary.score >= 70 ? [34, 197, 94] : report.summary.score >= 40 ? [234, 179, 8] : [239, 68, 68];
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${report.summary.score}`, marginL, y);

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`  ${report.summary.grade} - ${gradeLabels[report.summary.grade]}`, marginL + 20, y);
  y += 5;

  if (report.summary.opportunityScore !== undefined) {
    doc.setFontSize(9);
    doc.setTextColor(180, 130, 0);
    doc.text(`Opportunity Score: ${report.summary.opportunityScore}`, marginL, y);
    y += 5;
  }

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Recommendation: ${recommendationLabels[report.summary.recommendation]}`, marginL, y);
  y += 8;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const verdictLines = doc.splitTextToSize(report.summary.verdict, contentW);
  checkPage(verdictLines.length * 5 + 5);
  doc.text(verdictLines, marginL, y);
  y += verdictLines.length * 5 + 5;

  doc.setDrawColor(200, 200, 200);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Critical Issues", marginL, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  report.summary.topIssues.forEach((issue) => {
    checkPage(15);
    const sevLabel = issue.severity === "critical" ? "[CRITICAL]" : issue.severity === "high" ? "[HIGH]" : "[MEDIUM]";
    doc.setFont("helvetica", "bold");
    doc.text(`${sevLabel} ${issue.title}`, marginL, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(issue.description, contentW - 5);
    doc.text(descLines, marginL + 3, y);
    y += descLines.length * 4 + 4;
  });

  y += 3;
  checkPage(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Priority Actions", marginL, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  report.summary.priorityActions.forEach((action) => {
    checkPage(15);
    doc.setFont("helvetica", "bold");
    const actionHeader = `${action.order}. ${action.action}`;
    const headerLines = doc.splitTextToSize(actionHeader, contentW - 5);
    doc.text(headerLines, marginL, y);
    y += headerLines.length * 4;
    doc.setFont("helvetica", "normal");
    if (action.reason) {
      const reasonLines = doc.splitTextToSize(`Reason: ${action.reason}`, contentW - 8);
      doc.setTextColor(100, 100, 100);
      doc.text(reasonLines, marginL + 5, y);
      doc.setTextColor(0, 0, 0);
      y += reasonLines.length * 4;
    }
    if (action.opportunityScore !== undefined) {
      doc.setTextColor(180, 130, 0);
      doc.text(`Opportunity: ${action.opportunityScore}`, marginL + 5, y);
      doc.setTextColor(0, 0, 0);
      y += 4;
    }
    y += 3;
  });

  y += 3;
  checkPage(10);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Diagnosis Details", marginL, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  Object.entries(report.detail.diagnosis).forEach(([key, dim]) => {
    const d = dim as { score: number; analysis: string };
    checkPage(15);
    doc.setFont("helvetica", "bold");
    doc.text(`${key}: ${d.score}/100`, marginL, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const aLines = doc.splitTextToSize(d.analysis, contentW - 5);
    doc.text(aLines, marginL + 3, y);
    y += aLines.length * 4 + 4;
  });

  y += 3;
  checkPage(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("AI Reasoning", marginL, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const reasoningLines = doc.splitTextToSize(report.detail.reasoning, contentW);
  checkPage(reasoningLines.length * 4 + 5);
  doc.text(reasoningLines, marginL, y);
  y += reasoningLines.length * 4 + 5;

  checkPage(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Execution Suggestions", marginL, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  report.detail.executionSuggestions.forEach((s, i) => {
    checkPage(10);
    const sLines = doc.splitTextToSize(`${i + 1}. ${s}`, contentW - 5);
    doc.text(sLines, marginL, y);
    y += sLines.length * 4 + 2;
  });

  y += 5;
  checkPage(10);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by AI Marketing Judgment System", marginL, y);
  doc.text(new Date().toLocaleString(), pageW - marginR, y, { align: "right" });

  const fileName = `judgment-${report.caseId}-v${report.version}.pdf`;
  doc.save(fileName);
}

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [historyTab, setHistoryTab] = useState<"sessions" | "reports">("sessions");
  const [selectedReport, setSelectedReport] = useState<JudgmentReport | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [dialogTab, setDialogTab] = useState("summary");
  const [exportingPdf, setExportingPdf] = useState(false);
  const { toast } = useToast();

  const { data: records, isLoading } = useQuery<JudgmentRecord[]>({
    queryKey: ["/api/judgment/history"],
  });

  const { data: reviewSessions = [], isLoading: loadingSessions } = useQuery<ReviewSession[]>({
    queryKey: ["/api/review-sessions"],
  });

  const filteredRecords = records?.filter((r) => {
    const matchType = typeFilter === "all" || r.type === typeFilter;
    const matchSearch =
      !searchQuery ||
      r.verdict.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.url && r.url.toLowerCase().includes(searchQuery.toLowerCase())) ||
      judgmentTypeLabels[r.type].includes(searchQuery);
    return matchType && matchSearch;
  });

  const handleViewReport = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await apiRequest("GET", `/api/judgment/${id}`);
      const data = await res.json();
      setSelectedReport(data);
      setDialogTab("summary");
      setIsDialogOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleExportPdf = useCallback(async () => {
    if (!selectedReport) return;
    setExportingPdf(true);
    try {
      await generatePdf(selectedReport);
      toast({ title: "PDF 匯出成功", description: "報告已下載至您的裝置" });
    } catch (err) {
      console.error(err);
      toast({ title: "PDF 匯出失敗", description: "請稍後再試", variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  }, [selectedReport, toast]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const formatSessionDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <h1 className="page-title" data-testid="text-page-title">
            判讀紀錄
          </h1>
        </div>
        <Tabs value={historyTab} onValueChange={(v) => setHistoryTab(v as "sessions" | "reports")} className="w-full sm:w-auto">
          <TabsList data-testid="tabs-history">
            <TabsTrigger value="sessions" data-testid="tab-sessions">對話紀錄</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">審判報告</TabsTrigger>
          </TabsList>
        </Tabs>
        {historyTab === "reports" && (
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="全部類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部類型</SelectItem>
              <SelectItem value="creative">素材審判</SelectItem>
              <SelectItem value="landing_page">銷售頁審判</SelectItem>
              <SelectItem value="fb_ads">FB/Meta 廣告審判</SelectItem>
              <SelectItem value="ga4_funnel">GA4 漏斗審判</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="搜尋紀錄..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-history"
            />
          </div>
        </div>
        )}
      </header>

      <div className="min-h-full p-4">
        {historyTab === "sessions" && (
          <>
            {loadingSessions ? (
              <div className="space-y-3 max-w-3xl mx-auto">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !reviewSessions.length ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">尚無對話紀錄</p>
                <p className="text-xs mt-1">在「內容判讀」開始對話後，這裡會列出所有對話串</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-3xl mx-auto">
                {reviewSessions.map((s) => (
                  <Link key={s.id} href={`/judgment?sessionId=${encodeURIComponent(s.id)}`}>
                    <Card className="hover-elevate cursor-pointer" data-testid={`card-session-${s.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-1">{s.title || "未命名判讀"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {s.messages.length} 則訊息 · {formatSessionDate(s.updatedAt)}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
        {historyTab === "reports" && (isLoading ? (
          <div className="space-y-3 max-w-3xl mx-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="w-10 h-6 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !filteredRecords?.length ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <History className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">
              {searchQuery || typeFilter !== "all" ? "找不到符合的紀錄" : "尚無審判紀錄"}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {filteredRecords.map((record, i) => {
              const TypeIcon = typeIcons[record.type];
              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                >
                  <Card className="hover-elevate" data-testid={`card-history-${record.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${typeIconBg[record.type]}`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] ${typeColors[record.type]}`}>
                              {judgmentTypeLabels[record.type]}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] ${recommendationColors[record.recommendation]}`}>
                              {recommendationLabels[record.recommendation]}
                            </Badge>
                            <RecommendationLevelBadge level={record.recommendationLevel} />
                            <OpportunityScoreBadge score={record.opportunityScore} />
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-1" data-testid={`text-verdict-${record.id}`}>
                            {record.verdict}
                          </p>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatDate(record.createdAt)}
                            </span>
                            {record.version > 1 && (
                              <Badge variant="secondary" className="text-[10px]">v{record.version}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <HistoryScoreBadge score={record.score} grade={record.grade} />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewReport(record.id)}
                            disabled={loadingId === record.id}
                            data-testid={`button-view-${record.id}`}
                          >
                            {loadingId === record.id ? (
                              <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                onClick={handleExportPdf}
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
                <Badge variant="outline" className={typeColors[selectedReport.type]}>
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

              <Tabs value={dialogTab} onValueChange={setDialogTab}>
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
                              color: selectedReport.summary.score >= 70 ? "#22c55e" : selectedReport.summary.score >= 40 ? "#eab308" : "#ef4444",
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

                      <div className={`rounded-lg border p-3 ${recommendationColors[selectedReport.summary.recommendation]}`}>
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          <span className="font-semibold text-sm">{recommendationLabels[selectedReport.summary.recommendation]}</span>
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
                        <h4 className="text-sm font-semibold text-emerald-600 mb-2 flex items-center gap-1.5" data-testid="text-priority-actions-title">
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
                            const impactLabels: Record<string, string> = { high: "高影響", medium: "中影響", low: "低影響" };
                            return (
                              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-emerald-500/[0.04] border border-emerald-500/10" data-testid={`card-priority-action-${i}`}>
                                <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
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
                                  <Badge variant="secondary" className={`text-[10px] ${impactColors[action.impact] || ""}`}>
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
                          const scoreColor = d.score >= 70 ? "text-emerald-700" : d.score >= 40 ? "text-amber-700" : "text-red-700";
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
    </div>
  );
}
