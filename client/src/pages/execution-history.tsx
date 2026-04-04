/** 全域執行稽核：預覽、正式套用、結果與錯誤（可追蹤）。 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { ExecutionLogEntry } from "@/components/ExecutionLogDialog";
import { formatRollbackSnapshot, summarizeExecutionTarget } from "@/lib/execution-log-display";

function statusLabel(status: string): string {
  if (status === "recorded") return "預覽";
  if (status === "applied") return "已套用";
  if (status === "applied_stub") return "失敗";
  if (status === "note_only") return "僅備註";
  return status;
}

function shortUserId(userId: string): string {
  if (userId.length <= 14) return userId;
  return `${userId.slice(0, 6)}…${userId.slice(-4)}`;
}

function kindLabel(kind: string): string {
  if (kind === "dry_run") return "預覽";
  if (kind === "apply") return "套用";
  return kind;
}

export default function ExecutionHistoryPage() {
  const [kindFilter, setKindFilter] = useState<"all" | "dry_run" | "apply">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "recorded" | "applied" | "applied_stub" | "note_only"
  >("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/execution/logs", "audit"],
    queryFn: async () => {
      const res = await fetch("/api/execution/logs?limit=200", { credentials: "include" });
      if (!res.ok) throw new Error("logs");
      return res.json() as Promise<{ logs: ExecutionLogEntry[] }>;
    },
  });

  const logs = data?.logs ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((row) => {
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.actionType.toLowerCase().includes(q) ||
        row.dryRunId.toLowerCase().includes(q) ||
        (row.errorMessage?.toLowerCase().includes(q) ?? false) ||
        (row.resultSummary?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [logs, kindFilter, statusFilter, search]);

  return (
    <div className="flex flex-col min-h-full" data-testid="execution-history-page">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <h1 className="font-semibold">執行稽核紀錄</h1>
      </header>
      <div className="p-4 page-container-fluid max-w-7xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">全域紀錄（最近 200 筆事件）</CardTitle>
            <p className="text-sm text-muted-foreground">
              含預覽與正式套用紀錄；是否實際寫入廣告帳戶依當次操作類型與確認結果而定。
            </p>
            <div
              className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-end"
              data-testid="execution-history-filters"
            >
              <div className="space-y-1 min-w-[140px]">
                <label className="text-xs text-muted-foreground">類型</label>
                <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
                  <SelectTrigger aria-label="篩選紀錄類型">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="dry_run">預覽</SelectItem>
                    <SelectItem value="apply">套用／結果</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-[140px]">
                <label className="text-xs text-muted-foreground">狀態</label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger aria-label="篩選狀態">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="recorded">預覽（recorded）</SelectItem>
                    <SelectItem value="applied">已套用</SelectItem>
                    <SelectItem value="applied_stub">失敗</SelectItem>
                    <SelectItem value="note_only">僅備註</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1 min-w-[200px] max-w-md">
                <label className="text-xs text-muted-foreground">關鍵字（action／dryRunId／摘要／錯誤）</label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="篩選…"
                  aria-label="執行紀錄關鍵字"
                />
              </div>
              <p className="text-xs text-muted-foreground sm:ml-auto">
                顯示 {filtered.length} / {logs.length} 筆
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                載入中…
              </div>
            )}
            {!isLoading && logs.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">尚無紀錄</p>
            )}
            {!isLoading && logs.length > 0 && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">無符合篩選條件的紀錄</p>
            )}
            {!isLoading && filtered.length > 0 && (
              <div className="overflow-x-auto table-scroll-container">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>時間</TableHead>
                      <TableHead className="whitespace-nowrap">操作者</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>動作</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>目標／受影響</TableHead>
                      <TableHead className="min-w-[140px]">變更快照</TableHead>
                      <TableHead>摘要／錯誤</TableHead>
                      <TableHead className="font-mono text-xs">dryRunId</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const snap = formatRollbackSnapshot(row.resultMeta);
                      const snapShort =
                        snap && snap.length > 96 ? `${snap.slice(0, 93)}…` : snap;
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {new Date(row.timestamp).toLocaleString("zh-TW")}
                          </TableCell>
                          <TableCell
                            className="font-mono text-xs max-w-[100px] truncate align-top"
                            title={row.userId}
                          >
                            {shortUserId(row.userId)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{kindLabel(row.kind)}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{row.actionType}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{statusLabel(row.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[160px] break-words align-top">
                            {summarizeExecutionTarget(row.resultMeta, row.affectedIds)}
                          </TableCell>
                          <TableCell
                            className="text-xs text-muted-foreground max-w-[200px] align-top"
                            title={snap ?? undefined}
                          >
                            {snapShort ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs max-w-md break-words align-top">
                            {row.errorMessage && (
                              <span className="text-destructive">{row.errorMessage}</span>
                            )}
                            {row.resultSummary && !row.errorMessage && <span>{row.resultSummary}</span>}
                            {row.planSummary && row.kind === "dry_run" && (
                              <span className="text-muted-foreground">{row.planSummary}</span>
                            )}
                            {row.rollbackNote && (
                              <span className="block mt-1 text-amber-800 dark:text-amber-200">
                                還原備註：{row.rollbackNote}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[120px] truncate align-top">
                            {row.dryRunId}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
