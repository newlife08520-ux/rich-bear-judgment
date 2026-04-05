import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Image, Gavel, Send } from "lucide-react";
import { TASK_STATUS } from "@/lib/decision-workbench";
import type { TaskStatusKey } from "@/lib/decision-workbench";
import type { WorkbenchTask } from "@shared/workbench-types";
import { cn } from "@/lib/utils";
import {
  TASK_SOURCE_LABELS,
  TASK_PRIORITY_LABELS,
  formatDueDate,
  getDueDateState,
} from "../tasks-formatters";
import type { TasksWorkbench } from "../useTasksWorkbench";

export function TasksDataTable({ wb }: { wb: TasksWorkbench }) {
  const {
    tasks,
    sortedTasks,
    tasksIsError,
    onlyMine,
    highlightTaskId,
    rowRefs,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    updateMutation,
    employees,
    editingNotes,
    setEditingNotes,
  } = wb;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 p-2">
                  <Checkbox
                    checked={tasks.length > 0 && selectedIds.size === tasks.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="全選"
                  />
                </th>
                <th className="text-left p-2">來源</th>
                <th className="text-left p-2">優先級</th>
                <th className="text-left p-2">標題／商品·素材</th>
                <th className="text-left p-2">建議動作</th>
                <th className="text-left p-2">理由</th>
                <th className="text-left p-2">截止日</th>
                <th className="text-left p-2">影響金額</th>
                <th className="text-left p-2">類型</th>
                <th className="text-left p-2">指派</th>
                <th className="text-left p-2">狀態</th>
                <th className="text-left p-2">備註</th>
                <th className="text-left p-2">更新</th>
                <th className="text-left p-2 w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-6 text-center text-muted-foreground">
                    {tasksIsError
                      ? "任務列表無法載入，請見上方說明。"
                      : onlyMine
                        ? "目前沒有指派給你的任務。"
                        : "尚無任務，請從商品中心或審判官一鍵生成，或在此建立。"}
                  </td>
                </tr>
              ) : (
                sortedTasks.map((t) => (
                  <tr
                    key={t.id}
                    ref={(el) => {
                      rowRefs.current[t.id] = el;
                    }}
                    data-task-id={t.id}
                    className={cn(
                      "border-b hover:bg-muted/30",
                      highlightTaskId === t.id && "bg-indigo-50 ring-2 ring-indigo-200 ring-inset dark:bg-indigo-950/30 dark:ring-indigo-800/50"
                    )}
                  >
                    <td className="p-2">
                      <Checkbox
                        checked={selectedIds.has(t.id)}
                        onCheckedChange={() => toggleSelect(t.id)}
                        aria-label={`選取 ${t.title}`}
                      />
                    </td>
                    <td className="p-2 text-muted-foreground whitespace-nowrap">
                      {t.taskSource ? TASK_SOURCE_LABELS[t.taskSource] ?? t.taskSource : "—"}
                    </td>
                    <td className="p-2">
                      {t.priority ? TASK_PRIORITY_LABELS[t.priority] ?? t.priority : "—"}
                    </td>
                    <td className="p-2">
                      <span className="font-medium">{t.title}</span>
                      {(t.productName || t.creativeId) && (
                        <span className="block text-xs text-muted-foreground">
                          {[t.productName, t.creativeId].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="p-2">{t.action}</td>
                    <td className="p-2 text-muted-foreground max-w-[180px] truncate" title={t.reason}>
                      {t.reason}
                    </td>
                    <td
                      className={cn(
                        "p-2 whitespace-nowrap",
                        getDueDateState(t.dueDate ?? undefined) === "overdue" && "text-rose-600 font-medium",
                        getDueDateState(t.dueDate ?? undefined) === "today" && "text-amber-600 font-medium",
                        getDueDateState(t.dueDate ?? undefined) === "within3" && "text-amber-600"
                      )}
                    >
                      {formatDueDate(t.dueDate ?? undefined)}
                    </td>
                    <td className="p-2 text-muted-foreground">{t.impactAmount || "—"}</td>
                    <td className="p-2 text-muted-foreground">{t.taskType || "—"}</td>
                    <td className="p-2">
                      <Select
                        value={t.assigneeId || "none"}
                        onValueChange={(v) =>
                          updateMutation.mutate({ id: t.id, patch: { assigneeId: v === "none" ? null : v } })
                        }
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue placeholder="指派" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">未指派</SelectItem>
                          {employees.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Select
                        value={t.status}
                        onValueChange={(v) =>
                          updateMutation.mutate({
                            id: t.id,
                            patch: { status: v as TaskStatusKey },
                          })
                        }
                      >
                        <SelectTrigger className="w-[110px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TASK_STATUS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-8 w-36"
                        placeholder="備註"
                        value={editingNotes[t.id] ?? t.notes}
                        onChange={(e) =>
                          setEditingNotes((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                        onBlur={() => {
                          const v = editingNotes[t.id];
                          if (v !== undefined && v !== t.notes)
                            updateMutation.mutate({ id: t.id, patch: { notes: v } });
                          setEditingNotes((prev) => {
                            const next = { ...prev };
                            delete next[t.id];
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(t.updatedAt).toLocaleString("zh-TW")}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        <Link
                          href={
                            t.productName
                              ? `/products?productName=${encodeURIComponent(t.productName)}`
                              : "/products"
                          }
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={t.productName ? `前往商品：${t.productName}` : "前往商品中心"}
                          >
                            <Package className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Link
                          href={
                            t.creativeId
                              ? `/creative-lifecycle?creativeId=${encodeURIComponent(t.creativeId)}`
                              : "/creative-lifecycle"
                          }
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={t.creativeId ? `前往素材：${t.creativeId}` : "前往素材生命週期"}
                          >
                            <Image className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Link
                          href={
                            t.reviewSessionId
                              ? `/judgment?sessionId=${encodeURIComponent(t.reviewSessionId)}`
                              : "/judgment"
                          }
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={t.reviewSessionId ? "前往對應判讀" : "前往審判官"}
                          >
                            <Gavel className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Link
                          href={
                            t.draftId
                              ? `/publish?draftId=${encodeURIComponent(t.draftId)}`
                              : t.productName
                                ? `/publish?productName=${encodeURIComponent(t.productName)}`
                                : t.creativeId
                                  ? `/publish?creativeId=${encodeURIComponent(t.creativeId)}`
                                  : "/publish"
                          }
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={
                              t.draftId
                                ? "開啟對應草稿"
                                : t.productName
                                  ? `前往投放（預填商品：${t.productName}）`
                                  : t.creativeId
                                    ? "前往投放中心（帶入素材）"
                                    : "前往投放中心"
                            }
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
