/**
 * 執行紀錄：顯示 /api/execution/logs（DB-backed），含時間、類型、狀態、摘要、受影響 ID／錯誤／rollback 備註
 * 已套用成功列可補寫備註 → POST /api/execution/rollback-note（不覆蓋 applied 語意）
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, StickyNote } from "lucide-react";
import { executionAppendRollbackNote } from "@/lib/execution-client";
import { formatRollbackSnapshot } from "@/lib/execution-log-display";
import { useToast } from "@/hooks/use-toast";

export type ExecutionLogEntry = {
  id: string;
  timestamp: string;
  userId: string;
  kind: string;
  actionType: string;
  dryRunId: string;
  status: string;
  planSummary?: string;
  resultSummary?: string;
  affectedIds?: string[];
  affectedCount?: number;
  errorMessage?: string;
  message?: string;
  rollbackNote?: string;
  resultMeta?: Record<string, unknown>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ExecutionLogDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDryRunId, setNoteDryRunId] = useState("");
  const [noteActionLabel, setNoteActionLabel] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const { data, isLoading } = useQuery<{ logs: ExecutionLogEntry[] }>({
    queryKey: ["/api/execution/logs"],
    queryFn: async () => {
      const res = await fetch("/api/execution/logs?limit=100", { credentials: "include" });
      if (!res.ok) throw new Error("取得執行紀錄失敗");
      return res.json();
    },
    enabled: open,
  });

  const logs = data?.logs ?? [];

  const openNoteDialog = (e: ExecutionLogEntry) => {
    setNoteDryRunId(e.dryRunId);
    setNoteActionLabel(e.actionType);
    setNoteText(e.rollbackNote ?? "");
    setNoteOpen(true);
  };

  const submitNote = async () => {
    if (!noteDryRunId.trim()) return;
    setNoteSaving(true);
    try {
      const out = await executionAppendRollbackNote(noteDryRunId.trim(), noteText);
      if (!out.ok) {
        toast({
          title: "寫入失敗",
          description: out.message ?? "請稍後再試",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "已儲存備註" });
      setNoteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/execution/logs"] });
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>執行紀錄</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="flex-1 rounded border p-2 min-h-[200px]">
              <ul className="space-y-3 text-sm">
                {logs.length === 0 ? (
                  <li className="text-muted-foreground py-4 text-center">尚無執行紀錄</li>
                ) : (
                  logs.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-md border bg-card p-3 space-y-1"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        <span>{new Date(e.timestamp).toLocaleString("zh-TW")}</span>
                        <span className="font-medium text-foreground">{e.actionType}</span>
                        <span className="text-xs font-mono opacity-80">{e.kind}</span>
                        <span
                          className={
                            e.status === "applied"
                              ? "text-[var(--status-profit)]"
                              : e.status === "applied_stub"
                                ? "text-destructive"
                                : ""
                          }
                        >
                          {e.status === "recorded"
                            ? "預覽"
                            : e.status === "applied"
                              ? "已套用"
                              : e.status === "applied_stub"
                                ? "失敗"
                                : e.status}
                        </span>
                      </div>
                      {(e.planSummary ?? e.resultSummary ?? e.message) && (
                        <div className="text-foreground">
                          {e.planSummary ?? e.resultSummary ?? e.message}
                        </div>
                      )}
                      {e.kind === "apply" && e.status === "applied" && e.resultSummary && (
                        <div className="text-muted-foreground text-xs">結果摘要：{e.resultSummary}</div>
                      )}
                      {(e.affectedIds?.length ?? 0) > 0 && (
                        <div className="text-muted-foreground">
                          受影響：{e.affectedIds!.slice(0, 8).join(", ")}
                          {(e.affectedIds!.length ?? 0) > 8 && " …"}
                        </div>
                      )}
                      {e.affectedCount != null && e.kind === "apply" && (
                        <div className="text-muted-foreground">筆數：{e.affectedCount}</div>
                      )}
                      {e.errorMessage && (
                        <div className="text-destructive text-xs">{e.errorMessage}</div>
                      )}
                      {e.message && e.kind === "dry_run" && (
                        <div className="text-amber-600 text-xs">備註／rollback：{e.message}</div>
                      )}
                      {e.rollbackNote && e.kind === "apply" && (
                        <div className="text-foreground text-xs border-l-2 border-amber-500/60 pl-2 mt-1">
                          操作員備註：{e.rollbackNote}
                        </div>
                      )}
                      {e.kind === "apply" &&
                        e.status === "applied" &&
                        formatRollbackSnapshot(e.resultMeta) && (
                          <div className="text-muted-foreground text-xs">
                            Rollback 快照：{formatRollbackSnapshot(e.resultMeta)}
                          </div>
                        )}
                      {e.kind === "apply" && e.status === "applied" && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openNoteDialog(e)}
                          >
                            <StickyNote className="w-3.5 h-3.5 mr-1.5" />
                            補寫備註／rollback
                          </Button>
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>補寫備註（{noteActionLabel}）</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            僅附加於此筆已套用紀錄，不會將狀態改為「僅備註」；dryRunId：{" "}
            <span className="font-mono">{noteDryRunId}</span>
          </p>
          <Textarea
            value={noteText}
            onChange={(ev) => setNoteText(ev.target.value)}
            placeholder="例如：已於 Ads Manager 手動暫停、回滾原因…"
            rows={4}
            maxLength={2000}
            className="resize-y min-h-[100px]"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="secondary" onClick={() => setNoteOpen(false)} disabled={noteSaving}>
              取消
            </Button>
            <Button type="button" onClick={() => void submitNote()} disabled={noteSaving}>
              {noteSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
