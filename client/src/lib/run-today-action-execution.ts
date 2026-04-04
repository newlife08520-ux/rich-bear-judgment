import { useToast } from "@/hooks/use-toast";
import type { DecisionCardBlock } from "@shared/decision-cards-engine";
import type { TodayActionRow } from "@/pages/dashboard/dashboard-types";
import {
  mapTodayActionToExecution,
  mapSuggestedActionToExecution,
  resolveBudgetPctToMappedExecution,
} from "@/lib/map-suggested-action-to-execution";

export type MetaDryRunRequester = {
  requestDryRun: (actionType: string, payload: Record<string, unknown>) => Promise<void>;
};

export function createTodayActionExecutor(metaGate: MetaDryRunRequester, toast: ReturnType<typeof useToast>["toast"]) {
  return async function runTodayActionExecution(row: TodayActionRow): Promise<void> {
    const plan = mapTodayActionToExecution(row);
    if (!plan) return;
    if ("kind" in plan && plan.kind === "budget_pct") {
      const mapped = await resolveBudgetPctToMappedExecution(plan);
      if (!mapped) {
        toast({
          title: "無法換算預算",
          description: "找不到此活動的每日預算，請至預算控制確認資料已同步。",
          variant: "destructive",
        });
        return;
      }
      await metaGate.requestDryRun(mapped.actionType, mapped.payload);
      return;
    }
    if ("actionType" in plan) {
      await metaGate.requestDryRun(plan.actionType, plan.payload);
    }
  };
}

export function createDecisionCardExecutor(metaGate: MetaDryRunRequester, toast: ReturnType<typeof useToast>["toast"]) {
  return async function runDecisionCardExecution(card: DecisionCardBlock): Promise<void> {
    const plan = mapSuggestedActionToExecution(card);
    if (!plan) return;
    if ("kind" in plan && plan.kind === "budget_pct") {
      const mapped = await resolveBudgetPctToMappedExecution(plan);
      if (!mapped) {
        toast({
          title: "無法換算預算",
          description: "找不到此活動的每日預算，請至預算控制確認資料已同步。",
          variant: "destructive",
        });
        return;
      }
      await metaGate.requestDryRun(mapped.actionType, mapped.payload);
      return;
    }
    if ("actionType" in plan) {
      await metaGate.requestDryRun(plan.actionType, plan.payload);
    }
  };
}
