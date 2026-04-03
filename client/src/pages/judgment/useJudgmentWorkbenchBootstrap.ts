import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { DecisionCardBlock } from "@shared/decision-cards-engine";

export function useJudgmentWorkbenchBootstrap(
  scopeKey: string,
  selectedAccountIds: string[] | undefined,
  sessionIdFromUrl: string | null
) {
  const decisionCardsParams = new URLSearchParams();
  if (scopeKey) decisionCardsParams.set("scope", scopeKey);
  if (selectedAccountIds?.length) {
    decisionCardsParams.set("scopeAccountIds", selectedAccountIds.join(","));
  }

  const { data: decisionCardsData } = useQuery({
    queryKey: ["/api/workbench/decision-cards", scopeKey, decisionCardsParams.toString()],
    queryFn: async () => {
      const q = decisionCardsParams.toString();
      const url = q ? `/api/workbench/decision-cards?${q}` : "/api/workbench/decision-cards";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { cards: [], goalPacingByProduct: {} };
      return res.json();
    },
  });
  const decisionCards: DecisionCardBlock[] = decisionCardsData?.cards ?? [];
  const goalPacingByProduct =
    (decisionCardsData as { goalPacingByProduct?: Record<string, import("@shared/goal-pacing-engine").GoalPacingEvaluation> })
      ?.goalPacingByProduct ?? {};

  const { data: sessionsList = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["/api/review-sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/review-sessions");
      return res.json();
    },
  });

  const { data: fetchedSession, isLoading: loadingSession } = useQuery({
    queryKey: ["/api/review-sessions", sessionIdFromUrl],
    queryFn: async () => {
      if (!sessionIdFromUrl) return null;
      const res = await apiRequest("GET", `/api/review-sessions/${sessionIdFromUrl}`);
      return res.json();
    },
    enabled: !!sessionIdFromUrl,
  });

  return {
    decisionCards,
    goalPacingByProduct,
    sessionsList,
    loadingSessions,
    fetchedSession,
    loadingSession,
  };
}
