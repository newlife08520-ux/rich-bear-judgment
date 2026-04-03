/**
 * 任務頁 execution gate：建立任務、批次改狀態／指派（server-owned apply，UI 不再在 apply 後做 mutation）
 */
import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { executionDryRun, executionApply } from "@/lib/execution-client";
import type { ExecGateState } from "@/lib/execution-client";

export type TaskCreateBody = {
  title: string;
  action: string;
  reason: string;
  productName?: string;
  taskSource?: string;
  priority?: string;
  dueDate?: string;
  impactAmount?: string;
  taskType?: string;
};

export type TaskBatchPatch = {
  ids: string[];
  status?: string;
  assigneeId?: string | null;
};

type Options = {
  /** apply 成功且非冪等重複時呼叫（關閉對話、清空表單、清除勾選等） */
  onApplySuccess?: () => void;
};

export function useTasksExecutionGate(options?: Options) {
  const onApplySuccess = options?.onApplySuccess;
  const { toast } = useToast();
  const [execGateOpen, setExecGateOpen] = useState(false);
  const [execGate, setExecGate] = useState<ExecGateState | null>(null);
  const [execKind, setExecKind] = useState<"create" | "batch" | null>(null);
  const [execCreateBody, setExecCreateBody] = useState<TaskCreateBody | null>(null);
  const [execBatchPatch, setExecBatchPatch] = useState<TaskBatchPatch | null>(null);
  const [execConfirmError, setExecConfirmError] = useState<string | null>(null);
  const [execBusy, setExecBusy] = useState(false);
  const lock = useRef(false);

  const requestTaskCreate = useCallback(
    async (body: TaskCreateBody) => {
      setExecBusy(true);
      setExecConfirmError(null);
      try {
        const dr = await executionDryRun("task_create", body);
        setExecGate({
          dryRunId: dr.dryRunId,
          summary: dr.plan.summary,
          steps: dr.plan.steps,
        });
        setExecCreateBody(body);
        setExecBatchPatch(null);
        setExecKind("create");
        setExecGateOpen(true);
      } catch (e) {
        toast({
          title: e instanceof Error ? e.message : "執行預覽失敗",
          variant: "destructive",
        });
      } finally {
        setExecBusy(false);
      }
    },
    [toast]
  );

  const startBatchExecution = useCallback(
    async (patch: TaskBatchPatch) => {
      if (patch.ids.length === 0) return;
      setExecBusy(true);
      setExecConfirmError(null);
      try {
        const dr = await executionDryRun("task_batch_patch", {
          ids: patch.ids,
          status: patch.status,
          assigneeId: patch.assigneeId,
        });
        setExecGate({
          dryRunId: dr.dryRunId,
          summary: dr.plan.summary,
          steps: dr.plan.steps,
        });
        setExecBatchPatch(patch);
        setExecCreateBody(null);
        setExecKind("batch");
        setExecGateOpen(true);
      } catch (e) {
        toast({
          title: e instanceof Error ? e.message : "執行預覽失敗",
          variant: "destructive",
        });
      } finally {
        setExecBusy(false);
      }
    },
    [toast]
  );

  const confirmTaskExecution = useCallback(async () => {
    if (!execGate || lock.current) return;
    if (execKind === "create" && !execCreateBody) return;
    if (execKind === "batch" && !execBatchPatch) return;
    lock.current = true;
    setExecBusy(true);
    setExecConfirmError(null);
    try {
      const result = await executionApply(execGate.dryRunId);
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      setExecGateOpen(false);
      setExecGate(null);
      setExecKind(null);
      setExecCreateBody(null);
      setExecBatchPatch(null);
      if (result.ok && result.alreadyApplied) {
        toast({ title: "已套用過", description: result.message });
      } else if (result.ok) {
        if (result.resultSummary) {
          toast({ title: "執行完成", description: result.resultSummary });
        }
        onApplySuccess?.();
      }
    } catch (e) {
      setExecConfirmError(e instanceof Error ? e.message : "核准或送出失敗");
    } finally {
      lock.current = false;
      setExecBusy(false);
    }
  }, [execGate, execKind, execCreateBody, execBatchPatch, toast, onApplySuccess]);

  const onExecGateOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setExecGate(null);
      setExecKind(null);
      setExecCreateBody(null);
      setExecBatchPatch(null);
      setExecConfirmError(null);
    }
    setExecGateOpen(open);
  }, []);

  return {
    requestTaskCreate,
    startBatchExecution,
    confirmTaskExecution,
    execGateOpen,
    onExecGateOpenChange,
    execGate,
    execConfirmError,
    execBusy,
    execGateConfirming: execBusy && !!execGate && execGateOpen,
  };
}
