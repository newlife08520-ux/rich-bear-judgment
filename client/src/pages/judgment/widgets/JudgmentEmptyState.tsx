import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EMPTY_ENTRIES,
  WORKFLOW_LAYER_1,
  getSubtypesForWorkflow,
  type EmptyEntry,
} from "../judgment-types";
import type { Workflow } from "@shared/schema";

export function JudgmentEmptyState({
  workflow,
  setWorkflow,
  selectedSubtype,
  setSelectedSubtype,
  setUiMode,
  onQuickPrompt,
  emptyVariant = "default",
}: {
  workflow: Workflow;
  setWorkflow: (w: Workflow) => void;
  selectedSubtype: string | null;
  setSelectedSubtype: (id: string | null) => void;
  setUiMode: (m: import("../judgment-types").UIMode) => void;
  onQuickPrompt: (text: string, w?: Workflow) => void;
  emptyVariant?: "default" | "focusMinimal";
}) {
  if (emptyVariant === "focusMinimal") {
    return (
      <p
        className="text-center text-[11px] text-muted-foreground py-2 leading-snug"
        data-testid="judgment-focus-minimal-empty"
      >
        輸入情境以取得裁決；決策卡請用頂欄「營運工作台」。
      </p>
    );
  }

  return (
    <div className="py-8">
      <p className="text-lg font-semibold text-center text-gray-900 mb-1">
        {selectedSubtype
          ? (EMPTY_ENTRIES.find((e) => e.id === selectedSubtype)?.emptyTitle ?? "裁決入口")
          : "裁決入口 — 拿判決，不是純聊天"}
      </p>
      <p className="text-sm text-center text-gray-600 mb-4">
        {selectedSubtype
          ? (EMPTY_ENTRIES.find((e) => e.id === selectedSubtype)?.emptySubtitle ?? "選擇類型或輸入問題")
          : "選擇「我要做什麼」與類型，總監會給出可執行的裁決與建議"}
      </p>
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 text-center">1. 我要做什麼</p>
          <div className="flex flex-wrap justify-center gap-2">
            {WORKFLOW_LAYER_1.map(({ workflow: w, label }) => (
              <Button
                key={w}
                type="button"
                variant={workflow === w ? "default" : "outline"}
                size="sm"
                className="rounded-full text-xs"
                onClick={() => {
                  setWorkflow(w);
                  setSelectedSubtype(null);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 text-center">2. 選擇類型</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {getSubtypesForWorkflow(workflow).map((e: EmptyEntry) => (
              <Card
                key={e.id}
                className="cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => {
                  setWorkflow(e.workflow);
                  setUiMode(e.mode);
                  setSelectedSubtype(e.id);
                  if (e.prompt) onQuickPrompt(e.prompt);
                }}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <span className="text-2xl">{e.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{e.label}</p>
                    <p className="text-xs text-muted-foreground">{e.short}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {getSubtypesForWorkflow(workflow).length === 0 && (
            <p className="text-xs text-center text-muted-foreground">此工作流暫無子類型，可直接在下方輸入</p>
          )}
        </div>
      </div>
      <p className="text-xs text-center text-muted-foreground mt-4">可貼網址、上傳圖片／影片／PDF，總監會一併參考。</p>
    </div>
  );
}
