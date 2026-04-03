import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { TaskCreateFromJudgmentPayload } from "./judgment-types";

export function useJudgmentCreateTaskMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  return useMutation({
    mutationFn: async (body: TaskCreateFromJudgmentPayload) => {
      const res = await fetch("/api/workbench/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: body.title,
          action: body.action,
          reason: body.reason,
          taskType: body.taskType ?? undefined,
          priority: body.priority ?? undefined,
          taskSource: body.taskSource ?? undefined,
          productName: body.productName ?? undefined,
          creativeId: body.creativeId ?? undefined,
          impactAmount: body.impactAmount ?? undefined,
          reviewSessionId: body.reviewSessionId ?? undefined,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("建立任務失敗");
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      toast({ title: "已建立任務", description: "前往行動紀錄", duration: 3000 });
      setLocation(`/tasks?highlight=${encodeURIComponent(data.id)}`);
    },
    onError: () => {
      toast({ variant: "destructive", title: "建立任務失敗" });
    },
  });
}
