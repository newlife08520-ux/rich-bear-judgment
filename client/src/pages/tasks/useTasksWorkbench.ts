import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmployee } from "@/lib/employee-context";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { WorkbenchTask } from "@shared/workbench-types";
import { getHighlightTaskId } from "./tasks-formatters";
import { useTasksExecutionGate } from "./useTasksExecutionGate";

export function useTasksWorkbench() {
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

  const { data: tasks = [], error: tasksError, isError: tasksIsError } = useQuery({
    queryKey: ["/api/workbench/tasks", onlyMine],
    queryFn: async () => {
      const url = onlyMine ? "/api/workbench/tasks?onlyMine=1" : "/api/workbench/tasks";
      const res = await fetch(url, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (body && typeof body.message === "string" ? body.message : null) || "任務資料暫不可用";
        throw new Error(msg);
      }
      return body as WorkbenchTask[];
    },
  });

  useEffect(() => {
    if (!highlightTaskId || tasks.length === 0) return;
    const el = rowRefs.current[highlightTaskId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlightTaskId, tasks.length]);

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<
        Pick<
          WorkbenchTask,
          "assigneeId" | "status" | "notes" | "priority" | "dueDate" | "impactAmount" | "taskType" | "taskSource"
        >
      >;
    }) => {
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

  const onTaskApplySuccess = useCallback(() => {
    setCreateOpen(false);
    setNewTitle("");
    setNewAction("");
    setNewReason("");
    setNewProductName("");
    setNewDueDate("");
    setNewImpactAmount("");
    setNewTaskType("");
    setSelectedIds(new Set());
    setBatchAssignOpen(false);
    setBatchStatusOpen(false);
  }, []);

  const execGate = useTasksExecutionGate({ onApplySuccess: onTaskApplySuccess });

  const requestTaskCreate = () => {
    if (!newTitle.trim() || !newAction.trim() || !newReason.trim()) return;
    execGate.requestTaskCreate({
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

  const startBatchExecution = (patch: { ids: string[]; status?: string; assigneeId?: string | null }) => {
    setBatchStatusOpen(false);
    setBatchAssignOpen(false);
    execGate.startBatchExecution(patch);
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
    const active = (t: WorkbenchTask) => (["unassigned", "assigned", "in_progress"].includes(t.status) ? 0 : 1);
    if (active(a) !== active(b)) return active(a) - active(b);
    if (priorityOrder(a.priority) !== priorityOrder(b.priority)) return priorityOrder(a.priority) - priorityOrder(b.priority);
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const activeTasks = (tasks as WorkbenchTask[]).filter((t) =>
    ["unassigned", "assigned", "in_progress"].includes(t.status)
  );
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
  const unassigned = tasks.filter(
    (t: WorkbenchTask) => t.status === "unassigned" || t.status === "assigned"
  );
  const inProgress = tasks.filter((t: WorkbenchTask) => t.status === "in_progress");
  const done = tasks.filter((t: WorkbenchTask) => t.status === "done" || t.status === "pending_confirm");

  return {
    highlightTaskId,
    rowRefs,
    employees,
    employee,
    authUser,
    toast,
    tasks: tasks as WorkbenchTask[],
    tasksError,
    tasksIsError,
    onlyMine,
    setOnlyMine,
    selectedIds,
    setSelectedIds,
    selectedCount: selectedIds.size,
    createOpen,
    setCreateOpen,
    batchAssignOpen,
    setBatchAssignOpen,
    batchStatusOpen,
    setBatchStatusOpen,
    newTitle,
    setNewTitle,
    newAction,
    setNewAction,
    newReason,
    setNewReason,
    newProductName,
    setNewProductName,
    newTaskSource,
    setNewTaskSource,
    newPriority,
    setNewPriority,
    newDueDate,
    setNewDueDate,
    newImpactAmount,
    setNewImpactAmount,
    newTaskType,
    setNewTaskType,
    editingNotes,
    setEditingNotes,
    updateMutation,
    requestTaskCreate,
    startBatchExecution,
    confirmTaskExecution: execGate.confirmTaskExecution,
    execGateOpen: execGate.execGateOpen,
    onExecGateOpenChange: execGate.onExecGateOpenChange,
    execGate: execGate.execGate,
    execConfirmError: execGate.execConfirmError,
    execBusy: execGate.execBusy,
    execGateConfirming: execGate.execGateConfirming,
    toggleSelect,
    toggleSelectAll,
    sortedTasks,
    highPriority,
    dueToday,
    highImpact,
    unassigned,
    inProgress,
    done,
  };
}

export type TasksWorkbench = ReturnType<typeof useTasksWorkbench>;
