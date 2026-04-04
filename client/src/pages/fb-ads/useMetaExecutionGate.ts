/**
 * Meta 操作員 UI：pause / resume / update_budget 經 execution layer（dry-run → 人工核准 → apply）
 * apply 成功後 invalidate fb-ads 相關 queries。
 */
import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { executionDryRun, executionApply } from "@/lib/execution-client";
import type { ExecGateState } from "@/lib/execution-client";

const FB_ADS_INVALIDATE_KEYS: unknown[][] = [
  ["/api/fb-ads/overview"],
  ["/api/fb-ads/high-risk"],
  ["/api/fb-ads/campaign-structure"],
  ["/api/fb-ads/budget-recommendations"],
  ["/api/fb-ads/alerts"],
  ["/api/fb-ads/opportunities"],
  ["/api/fb-ads/campaigns-scored"],
  ["/api/dashboard/action-center"],
];

function invalidateFbAds() {
  FB_ADS_INVALIDATE_KEYS.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: key });
  });
}

export type MetaBudgetPayload = {
  campaignId: string;
  budgetDaily?: number;
  budgetTotal?: number;
};

export function useMetaExecutionGate() {
  const { toast } = useToast();
  const [execGateOpen, setExecGateOpen] = useState(false);
  const [execGate, setExecGate] = useState<ExecGateState | null>(null);
  const [execConfirmError, setExecConfirmError] = useState<string | null>(null);
  const [execBusy, setExecBusy] = useState(false);
  const lock = useRef(false);

  const requestPause = useCallback(
    async (campaignId: string) => {
      setExecBusy(true);
      setExecConfirmError(null);
      try {
        const dr = await executionDryRun("meta_campaign_pause", { campaignId });
        setExecGate({
          dryRunId: dr.dryRunId,
          summary: dr.plan.summary,
          steps: dr.plan.steps,
        });
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

  const requestResume = useCallback(
    async (campaignId: string) => {
      setExecBusy(true);
      setExecConfirmError(null);
      try {
        const dr = await executionDryRun("meta_campaign_resume", { campaignId });
        setExecGate({
          dryRunId: dr.dryRunId,
          summary: dr.plan.summary,
          steps: dr.plan.steps,
        });
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

  const requestDryRun = useCallback(
    async (actionType: string, payload: Record<string, unknown>) => {
      setExecBusy(true);
      setExecConfirmError(null);
      try {
        const dr = await executionDryRun(actionType, payload);
        setExecGate({
          dryRunId: dr.dryRunId,
          summary: dr.plan.summary,
          steps: dr.plan.steps,
        });
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

  const requestBudgetUpdate = useCallback(
    async (payload: MetaBudgetPayload) => {
      const { campaignId, budgetDaily, budgetTotal } = payload;
      if (budgetDaily == null && budgetTotal == null) {
        toast({ title: "請至少填寫每日預算或總預算", variant: "destructive" });
        return;
      }
      setExecBusy(true);
      setExecConfirmError(null);
      try {
        const dr = await executionDryRun("meta_campaign_update_budget", {
          campaignId,
          budgetDaily: budgetDaily ?? undefined,
          budgetTotal: budgetTotal ?? undefined,
        });
        setExecGate({
          dryRunId: dr.dryRunId,
          summary: dr.plan.summary,
          steps: dr.plan.steps,
        });
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

  const confirmMetaExecution = useCallback(async () => {
    if (!execGate || lock.current) return;
    lock.current = true;
    setExecBusy(true);
    setExecConfirmError(null);
    try {
      const result = await executionApply(execGate.dryRunId);
      invalidateFbAds();
      setExecGateOpen(false);
      setExecGate(null);
      if (result.ok && result.resultSummary) {
        toast({ title: "執行完成", description: result.resultSummary });
      } else if (result.ok && result.alreadyApplied) {
        toast({ title: "已套用過", description: result.message });
      }
    } catch (e) {
      setExecConfirmError(e instanceof Error ? e.message : "核准或送出失敗");
    } finally {
      lock.current = false;
      setExecBusy(false);
    }
  }, [execGate, toast]);

  const onExecGateOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setExecGate(null);
      setExecConfirmError(null);
    }
    setExecGateOpen(open);
  }, []);

  return {
    requestPause,
    requestResume,
    requestDryRun,
    requestBudgetUpdate,
    confirmMetaExecution,
    execGateOpen,
    onExecGateOpenChange,
    execGate,
    execConfirmError,
    execBusy,
    execGateConfirming: execBusy && !!execGate && execGateOpen,
  };
}
