import { Scale, Download, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function JudgmentHeader({
  historyOpen,
  onToggleHistory,
  rightPanelOpen,
  onToggleRightPanel,
  onExportFullReport,
  onNewChat,
  layoutMode,
  onLayoutModeChange,
}: {
  historyOpen: boolean;
  onToggleHistory: () => void;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onExportFullReport: () => void;
  onNewChat: () => void;
  layoutMode: "focus" | "operator";
  onLayoutModeChange: (m: "focus" | "operator") => void;
}) {
  const focusSlim = layoutMode === "focus";

  return (
    <header className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-border bg-background shrink-0 no-print">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-9 w-9"
        onClick={onToggleHistory}
        aria-label={historyOpen ? "收合歷史" : "展開歷史"}
        data-testid="button-judgment-history-toggle"
      >
        {historyOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
      </Button>
      <div className="flex-1 min-w-0">
        <h1 className="page-title truncate text-lg sm:text-xl" data-testid="text-page-title">
          審判官
        </h1>
        {!focusSlim ? (
          <p className="text-xs text-muted-foreground truncate">王牌爆款陪跑行銷總監｜判讀素材、頁面、廣告與漏斗</p>
        ) : null}
        <div className="flex flex-wrap gap-1 mt-1.5" data-testid="judgment-layout-mode-toggle">
          <Button
            type="button"
            variant={layoutMode === "focus" ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-7 text-xs", layoutMode === "focus" && "ring-1 ring-border")}
            onClick={() => onLayoutModeChange("focus")}
          >
            聚焦審判
          </Button>
          <Button
            type="button"
            variant={layoutMode === "operator" ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-7 text-xs", layoutMode === "operator" && "ring-1 ring-border")}
            onClick={() => onLayoutModeChange("operator")}
          >
            營運工作台
          </Button>
        </div>
      </div>

      {focusSlim ? (
        <div className="flex items-center gap-1 shrink-0" data-testid="judgment-header-focus-actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-2 gap-1" aria-label="更多動作">
                <MoreHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">動作</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onExportFullReport} className="gap-2 cursor-pointer">
                <Download className="w-3.5 h-3.5" />
                匯出裁決報告
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewChat} className="gap-2 cursor-pointer">
                <Scale className="w-3.5 h-3.5" />
                新對話
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2"
            onClick={onToggleRightPanel}
            aria-label={rightPanelOpen ? "收合證據" : "證據"}
          >
            {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onExportFullReport}
            className="gap-1.5 no-print shrink-0"
            data-testid="button-export-full-report"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">📄 匯出裁決報告</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onNewChat} className="gap-1.5 shrink-0" data-testid="button-new-chat">
            <Scale className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">新對話</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={onToggleRightPanel}
            aria-label={rightPanelOpen ? "收合右側" : "展開右側"}
          >
            {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
            <span className="hidden sm:inline">證據</span>
          </Button>
        </>
      )}
    </header>
  );
}
