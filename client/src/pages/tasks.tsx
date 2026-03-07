/**
 * Phase 3A 任務中心：工作台化 — 來源、優先級、截止日、影響金額、類型、只看我負責、批次操作
 * 支援 ?highlight=<taskId> 建立後高亮並滾動到該筆；任務列深連結至商品／素材／審判／投放。
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ListTodo, Plus, Copy, User, Package, Image, Gavel, Send } from "lucide-react";
import { useEmployee } from "@/lib/employee-context";
import { useAuth } from "@/lib/auth";
import { TASK_STATUS } from "@/lib/decision-workbench";
import type { WorkbenchTask } from "@shared/workbench-types";
import { TASK_SOURCE_LABELS, TASK_PRIORITY_LABELS } from "@shared/workbench-types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";

/** 產出今日執行清單純文字（Slack/LINE 貼上即用） */
function formatTodayExecutionList(
  tasks: WorkbenchTask[],
  employees: { id: string; name: string }[]
): string {
  const empMap = new Map(employees.map((e) => [e.id, e.name]));
  const dateStr = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
  const active = tasks.filter((t) => ["unassigned", "assigned", "in_progress"].includes(t.status));
  const lines = ["【今日執行清單】 " + dateStr, ""];
  for (const t of active) {
    const who = t.assigneeId ? empMap.get(t.assigneeId) || t.assigneeId : "未指派";
    lines.push(`• ${t.title} － ${t.action} （負責：${who}）`);
  }
  if (active.length === 0) lines.push("（目前無待執行任務）");
  return lines.join("\n");
}

const TASK_SOURCE_OPTIONS = ["審判官", "素材生命週期", "汰換建議", "手動"] as const;
const PRIORITY_OPTIONS = ["high", "medium", "low"] as const;

function formatDueDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit", year: "numeric" });
}

/** 截止日視覺：已逾期紅、今日橘、3 天內黃 */
function getDueDateState(iso: string | undefined | null): "overdue" | "today" | "within3" | null {
  if (!iso) return null;
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 3) return "within3";
  return null;
}

/** 從 location 解析 ?highlight=<taskId> */
function getHighlightTaskId(loc: string): string | null {
  const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  return params.get("highlight")?.trim() || null;
}

export default function TasksPage() {
  const [location] = useLocation();
  const highlightTaskId = getHighlightTaskId(location);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const queryClient = useQueryClient();
  const { employees, employee } = useEmployee();
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [onlyMine, setOnlyMine] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState("");
  const [newAction, setNewAction] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newTaskSource, setNewTaskSource] = useState<string>("手動");
  const [newPriority, setNewPriority] = useState<string>("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newImpactAmount, setNewImpactAmount] = useState("");
  const [newTaskType, setNewTaskType] = useState("");
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [batchAssignOpen, setBatchAssignOpen] = useState(false);
  const [batchStatusOpen, setBatchStatusOpen] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ["/api/workbench/tasks", onlyMine],
    queryFn: async () => {
      const url = onlyMine ? "/api/workbench/tasks?onlyMine=1" : "/api/workbench/tasks";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (!highlightTaskId || tasks.length === 0) return;
    const el = rowRefs.current[highlightTaskId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlightTaskId, tasks.length]);

  const createMutation = useMutation({
    mutationFn: async (body: {
      title: string; action: string; reason: string; productName?: string;
      taskSource?: string; priority?: string; dueDate?: string; impactAmount?: string; taskType?: string;
    }) => {
      const res = await fetch("/api/workbench/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) throw new Error("建立失敗");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      setCreateOpen(false);
      setNewTitle("");
      setNewAction("");
      setNewReason("");
      setNewProductName("");
      setNewDueDate("");
      setNewImpactAmount("");
      setNewTaskType("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<WorkbenchTask, "assigneeId" | "status" | "notes" | "priority" | "dueDate" | "impactAmount" | "taskType" | "taskSource">> }) => {
      const res = await fetch(`/api/workbench/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        credentials: "include",
      });
      if (!res.ok) throw new Error("更新失敗");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] }),
  });

  const batchUpdateMutation = useMutation({
    mutationFn: async (payload: { ids: string[]; status?: string; assigneeId?: string | null }) => {
      const res = await fetch("/api/workbench/tasks/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) throw new Error("批次更新失敗");
      return res.json() as Promise<{ successCount: number; failCount: number; errors: { id: string; message: string }[] }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      setSelectedIds(new Set());
      setBatchAssignOpen(false);
      setBatchStatusOpen(false);
      const { successCount, failCount, errors } = data;
      if (failCount === 0) {
        toast({ title: `已更新 ${successCount} 筆任務`, duration: 2000 });
      } else {
        const summary = errors.slice(0, 3).map((e) => `${e.id.slice(0, 8)}…: ${e.message}`).join("；");
        toast({
          title: "批次更新結果",
          description: `成功 ${successCount} 筆，失敗 ${failCount} 筆。${summary}${errors.length > 3 ? " …" : ""}`,
          variant: failCount > 0 ? "destructive" : "default",
          duration: 6000,
        });
      }
    },
    onError: () => toast({ title: "批次更新失敗", variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!newTitle.trim() || !newAction.trim() || !newReason.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      action: newAction.trim(),
      reason: newReason.trim(),
      productName: newProductName.trim() || undefined,
      taskSource: newTaskSource || "手動",
      priority: newPriority || undefined,
      dueDate: newDueDate.trim() || undefined,
      impactAmount: newImpactAmount.trim() || undefined,
      taskType: newTaskType.trim() || undefined,
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) setSelectedIds(new Set());
    else setSelectedIds(new Set((tasks as WorkbenchTask[]).map((t) => t.id)));
  };

  const priorityOrder = (p: string | undefined | null) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
  const sortedTasks = [...(tasks as WorkbenchTask[])].sort((a, b) => {
    const active = (t: WorkbenchTask) => ["unassigned", "assigned", "in_progress"].includes(t.status) ? 0 : 1;
    if (active(a) !== active(b)) return active(a) - active(b);
    if (priorityOrder(a.priority) !== priorityOrder(b.priority)) return priorityOrder(a.priority) - priorityOrder(b.priority);
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const activeTasks = (tasks as WorkbenchTask[]).filter((t) => ["unassigned", "assigned", "in_progress"].includes(t.status));
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const highPriority = activeTasks.filter((t) => t.priority === "high");
  const dueToday = activeTasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate).getTime();
    return d >= todayStart.getTime() && d < todayEnd.getTime();
  });
  const highImpact = activeTasks.filter((t) => t.impactAmount && String(t.impactAmount).trim().length > 0);
  const unassigned = tasks.filter((t: WorkbenchTask) => t.status === "unassigned" || t.status === "assigned");
  const inProgress = tasks.filter((t: WorkbenchTask) => t.status === "in_progress");
  const done = tasks.filter((t: WorkbenchTask) => t.status === "done" || t.status === "pending_confirm");
  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <h1 className="page-title flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            任務中心
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              const text = formatTodayExecutionList(tasks, employees);
              navigator.clipboard.writeText(text).then(
                () => toast({ title: "已複製今日執行清單（Slack/LINE 格式）", duration: 2000 }),
                () => toast({ title: "複製失敗", variant: "destructive" })
              );
            }}
          >
            <Copy className="w-4 h-4" />
            複製為今日執行清單
          </Button>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            建立任務
          </Button>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 space-y-4">
        {/* 三張摘要卡：今天先做什麼 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-red-500/80 bg-card">
            <CardContent className="py-4 px-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">高優先</p>
              <p className="text-2xl font-bold mt-1">{highPriority.length}</p>
              <p className="text-xs text-muted-foreground mt-1">建議優先處理</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500/80 bg-card">
            <CardContent className="py-4 px-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">今日到期</p>
              <p className="text-2xl font-bold mt-1">{dueToday.length}</p>
              <p className="text-xs text-muted-foreground mt-1">今天要完成</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500/80 bg-card">
            <CardContent className="py-4 px-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">高影響金額</p>
              <p className="text-2xl font-bold mt-1">{highImpact.length}</p>
              <p className="text-xs text-muted-foreground mt-1">有標註影響金額</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/20">
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <span>待分配／已指派 <strong>{unassigned.length}</strong></span>
                <span>進行中 <strong>{inProgress.length}</strong></span>
                <span>已完成／待確認 <strong>{done.length}</strong></span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={onlyMine} onCheckedChange={(c) => setOnlyMine(!!c)} />
                只看我負責
              </label>
              {onlyMine && (
                <span className="text-xs text-muted-foreground">
                  目前以「{authUser?.username ?? authUser?.id ?? "登入者"}」(id: {authUser?.id ?? "—"}) 篩選
                  {authUser?.id && employee.id !== authUser.id && (
                    <span className="text-amber-600 ml-1">· 注意：目前為模擬身份切換，篩選依登入帳號為準，與左側角色可能不同</span>
                  )}
                </span>
              )}
            </div>
            </div>
            <p className="text-xs text-muted-foreground">依優先級與截止日安排，先處理高優先與即將到期任務。</p>
          </CardContent>
        </Card>

        {selectedCount > 0 && (
          <Card className="bg-muted/50">
            <CardContent className="py-2 px-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">已選 {selectedCount} 筆</span>
              <Button size="sm" variant="outline" onClick={() => setBatchStatusOpen(true)}>批次改狀態</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setBatchAssignOpen(true)}>
                <User className="w-3 h-3" /> 批次指派
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>取消選取</Button>
            </CardContent>
          </Card>
        )}

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
                        {onlyMine ? "目前沒有指派給你的任務。" : "尚無任務，請從商品作戰室或 RICH BEAR 審判官一鍵生成，或在此建立。"}
                      </td>
                    </tr>
                  ) : (
                    sortedTasks.map((t) => (
                      <tr
                        key={t.id}
                        ref={(el) => { rowRefs.current[t.id] = el; }}
                        data-task-id={t.id}
                        className={cn(
                          "border-b hover:bg-muted/30",
                          highlightTaskId === t.id && "bg-primary/10 ring-2 ring-primary ring-inset"
                        )}
                      >
                        <td className="p-2">
                          <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} aria-label={`選取 ${t.title}`} />
                        </td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{t.taskSource ? (TASK_SOURCE_LABELS[t.taskSource] ?? t.taskSource) : "—"}</td>
                        <td className="p-2">{t.priority ? (TASK_PRIORITY_LABELS[t.priority] ?? t.priority) : "—"}</td>
                        <td className="p-2">
                          <span className="font-medium">{t.title}</span>
                          {(t.productName || t.creativeId) && (
                            <span className="block text-xs text-muted-foreground">
                              {[t.productName, t.creativeId].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </td>
                        <td className="p-2">{t.action}</td>
                        <td className="p-2 text-muted-foreground max-w-[180px] truncate" title={t.reason}>{t.reason}</td>
                        <td className={cn(
                          "p-2 whitespace-nowrap",
                          getDueDateState(t.dueDate ?? undefined) === "overdue" && "text-red-600 font-medium",
                          getDueDateState(t.dueDate ?? undefined) === "today" && "text-orange-600 font-medium",
                          getDueDateState(t.dueDate ?? undefined) === "within3" && "text-amber-600"
                        )}>
                          {formatDueDate(t.dueDate ?? undefined)}
                        </td>
                        <td className="p-2 text-muted-foreground">{t.impactAmount || "—"}</td>
                        <td className="p-2 text-muted-foreground">{t.taskType || "—"}</td>
                        <td className="p-2">
                          <Select value={t.assigneeId || "none"} onValueChange={(v) => updateMutation.mutate({ id: t.id, patch: { assigneeId: v === "none" ? null : v } })}>
                            <SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="指派" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">未指派</SelectItem>
                              {employees.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select value={t.status} onValueChange={(v) => updateMutation.mutate({ id: t.id, patch: { status: v } })}>
                            <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(TASK_STATUS).map(([k, label]) => (<SelectItem key={k} value={k}>{label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8 w-36"
                            placeholder="備註"
                            value={editingNotes[t.id] ?? t.notes}
                            onChange={(e) => setEditingNotes((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            onBlur={() => {
                              const v = editingNotes[t.id];
                              if (v !== undefined && v !== t.notes) updateMutation.mutate({ id: t.id, patch: { notes: v } });
                              setEditingNotes((prev) => { const next = { ...prev }; delete next[t.id]; return next; });
                            }}
                          />
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{new Date(t.updatedAt).toLocaleString("zh-TW")}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            <Link href={t.productName ? `/products?productName=${encodeURIComponent(t.productName)}` : "/products"}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={t.productName ? `前往商品：${t.productName}` : "前往商品作戰室"}>
                                <Package className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            <Link href={t.creativeId ? `/creative-lifecycle?creativeId=${encodeURIComponent(t.creativeId)}` : "/creative-lifecycle"}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={t.creativeId ? `前往素材：${t.creativeId}` : "前往素材生命週期"}>
                                <Image className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            <Link href={t.reviewSessionId ? `/judgment?sessionId=${encodeURIComponent(t.reviewSessionId)}` : "/judgment"}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={t.reviewSessionId ? "前往對應判讀" : "前往 RICH BEAR 審判官"}>
                                <Gavel className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            <Link href={t.draftId ? `/publish?draftId=${encodeURIComponent(t.draftId)}` : t.productName ? `/publish?productName=${encodeURIComponent(t.productName)}` : t.creativeId ? `/publish?creativeId=${encodeURIComponent(t.creativeId)}` : "/publish"}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={t.draftId ? "開啟對應草稿" : t.productName ? `前往投放（預填商品：${t.productName}）` : t.creativeId ? "前往投放中心（帶入素材）" : "前往投放中心"}>
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
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>建立任務</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>標題</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="例：商品 A 停損" />
            </div>
            <div>
              <Label>任務來源</Label>
              <Select value={newTaskSource} onValueChange={setNewTaskSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_SOURCE_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{TASK_SOURCE_LABELS[s] ?? s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>優先級</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (<SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p] ?? p}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>截止日</Label>
                <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>商品名稱（選填）</Label>
              <Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="對應商品" />
            </div>
            <div>
              <Label>建議動作</Label>
              <Input value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="例：立即停損" />
            </div>
            <div>
              <Label>理由</Label>
              <Textarea value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="觸發規則或證據" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>影響金額（選填）</Label>
                <Input value={newImpactAmount} onChange={(e) => setNewImpactAmount(e.target.value)} placeholder="例：約 5 萬" />
              </div>
              <div>
                <Label>任務類型（選填）</Label>
                <Input value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} placeholder="例：停損" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || !newAction.trim() || !newReason.trim() || createMutation.isPending}>
              {createMutation.isPending ? "建立中…" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchStatusOpen} onOpenChange={setBatchStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>批次改狀態</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">已選 {selectedCount} 筆，請選擇新狀態：</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TASK_STATUS).map(([k, label]) => (
              <Button
                key={k}
                variant="outline"
                size="sm"
                onClick={() => batchUpdateMutation.mutate({ ids: [...selectedIds], status: k })}
                disabled={batchUpdateMutation.isPending}
              >
                {label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchAssignOpen} onOpenChange={setBatchAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>批次指派</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">已選 {selectedCount} 筆，請選擇負責人：</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => batchUpdateMutation.mutate({ ids: [...selectedIds], assigneeId: null })} disabled={batchUpdateMutation.isPending}>
              未指派
            </Button>
            {employees.map((e) => (
              <Button
                key={e.id}
                variant="outline"
                size="sm"
                onClick={() => batchUpdateMutation.mutate({ ids: [...selectedIds], assigneeId: e.id })}
                disabled={batchUpdateMutation.isPending}
              >
                {e.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
