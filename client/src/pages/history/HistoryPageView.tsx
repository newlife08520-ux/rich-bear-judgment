import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HistoryWorkbench } from "./useHistoryWorkbench";
import { HistoryFiltersBar } from "./widgets/HistoryFiltersBar";
import { HistorySessionsTab } from "./widgets/HistorySessionsTab";
import { HistoryReportsTab } from "./widgets/HistoryReportsTab";
import { HistoryReportDialog } from "./widgets/HistoryReportDialog";

export function HistoryPageView({ wb }: { wb: HistoryWorkbench }) {
  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <h1 className="page-title" data-testid="text-page-title">
            判讀紀錄
          </h1>
        </div>
        <Tabs
          value={wb.historyTab}
          onValueChange={(v) => wb.setHistoryTab(v as "sessions" | "reports")}
          className="w-full sm:w-auto"
        >
          <TabsList data-testid="tabs-history">
            <TabsTrigger value="sessions" data-testid="tab-sessions">
              對話紀錄
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">
              審判報告
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {wb.historyTab === "reports" && (
          <HistoryFiltersBar
            typeFilter={wb.typeFilter}
            onTypeFilter={wb.setTypeFilter}
            searchQuery={wb.searchQuery}
            onSearchQuery={wb.setSearchQuery}
          />
        )}
      </header>

      <div className="min-h-full p-4">
        {wb.historyTab === "sessions" && (
          <HistorySessionsTab loadingSessions={wb.loadingSessions} reviewSessions={wb.reviewSessions} />
        )}
        {wb.historyTab === "reports" && (
          <HistoryReportsTab
            isLoading={wb.isLoading}
            filteredRecords={wb.filteredRecords}
            searchQuery={wb.searchQuery}
            typeFilter={wb.typeFilter}
            loadingId={wb.loadingId}
            onViewReport={wb.handleViewReport}
          />
        )}
      </div>

      <HistoryReportDialog
        open={wb.isDialogOpen}
        onOpenChange={wb.setIsDialogOpen}
        selectedReport={wb.selectedReport}
        dialogTab={wb.dialogTab}
        onDialogTab={wb.setDialogTab}
        exportingPdf={wb.exportingPdf}
        onExportPdf={wb.handleExportPdf}
      />
    </div>
  );
}
