import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { JudgmentRecord, JudgmentReport, ReviewSession } from "@shared/schema";
import { judgmentTypeLabels } from "@shared/schema";
import { generateJudgmentReportPdf } from "./history-report";

export function useHistoryWorkbench() {
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

  const filteredRecords = useMemo(
    () =>
      records?.filter((r) => {
        const matchType = typeFilter === "all" || r.type === typeFilter;
        const matchSearch =
          !searchQuery ||
          r.verdict.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.url && r.url.toLowerCase().includes(searchQuery.toLowerCase())) ||
          judgmentTypeLabels[r.type].includes(searchQuery);
        return matchType && matchSearch;
      }) ?? [],
    [records, typeFilter, searchQuery]
  );

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
      await generateJudgmentReportPdf(selectedReport);
      toast({ title: "PDF 匯出成功", description: "報告已下載至您的裝置" });
    } catch (err) {
      console.error(err);
      toast({ title: "PDF 匯出失敗", description: "請稍後再試", variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  }, [selectedReport, toast]);

  return {
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    historyTab,
    setHistoryTab,
    selectedReport,
    setSelectedReport,
    isDialogOpen,
    setIsDialogOpen,
    loadingId,
    dialogTab,
    setDialogTab,
    exportingPdf,
    records,
    isLoading,
    reviewSessions,
    loadingSessions,
    filteredRecords,
    handleViewReport,
    handleExportPdf,
  };
}

export type HistoryWorkbench = ReturnType<typeof useHistoryWorkbench>;
