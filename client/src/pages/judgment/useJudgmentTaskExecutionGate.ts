/**
 * 審判官一鍵轉任務：dry-run → 核准 → apply（server-owned，UI 不再在 apply 後做 mutation）
 */
import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { executionDryRun, executionApply } from "@/lib/execution-client";
import type { ExecGateState } from "@/lib/execution-client";
import type { TaskCreateFromJudgmentPayload } from "./judgment-types";

export function useJudgmentTaskExecutionGate(
  _mutateAsync: (body: TaskCreateFromJudgmentPayload) => Promise<{ id: string }>
) {
  const { toast } = useToast();
  const [execGateOpen, setExecGateOpen] = useState(false);
  const [execGate, setExecGate] = useState<ExecGateState | null>(null);
  const [execPayload, setExecPayload] = useState<TaskCreateFromJudgmentPayload | null>(null);
  const [execConfirmError, setExecConfirmError] = useState<string | null>(null);
  const [execBusy, setExecBusy] = useState(false);
  const lock = useRef(false);

  const handleCreateTaskFromJudgment = useCallback(
    async (payload: TaskCreateFromJudgmentPayload) => {
      setExecBusy(true);
      setExecConfirmError(null);
      try {
        const dr = await executionDryRun("task_create_from_judgment", payload);
        setExecGate({
          dryRunId: dr.dryRunId,
          summary: dr.plan.summary,
          steps: dr.plan.steps,
        });
        setExecPayload(payload);
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

  const confirmTaskCreate = useCallback(async () => {
    if (!execGate || !execPayload || lock.current) return;
    lock.current = true;
    setExecBusy(true);
    setExecConfirmError(null);
    try {
      const result = await executionApply(execGate.dryRunId);
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      setExecGateOpen(false);
      setExecGate(null);
      setExecPayload(null);
      if (result.ok && result.resultSummary) {
        toast({ title: "執行完成", description: result.resultSummary });
      } else if (result.ok && result.alreadyApplied) {
        toast({ title: "已套用過", description: result.message });
      }
    } catch (e) {
      setExecConfirmError(e instanceof Error ? e.message : "核准或建立失敗");
    } finally {
      lock.current = false;
      setExecBusy(false);
    }
  }, [execGate, execPayload, toast]);

  const onExecGateOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !execBusy) {
        setExecGate(null);
        setExecPayload(null);
        setExecConfirmError(null);
      }
      setExecGateOpen(open);
    },
    [execBusy]
  );

  return {
    handleCreateTaskFromJudgment,
    judgmentExecGateOpen: execGateOpen,
    onJudgmentExecGateOpenChange: onExecGateOpenChange,
    judgmentExecGate: execGate,
    confirmJudgmentTaskCreate: confirmTaskCreate,
    judgmentExecConfirmError: execConfirmError,
    judgmentExecGateConfirming: execBusy && !!execGate && execGateOpen,
    judgmentTaskGateBusy: execBusy,
  };
}
