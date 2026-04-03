import type { QueryClient } from "@tanstack/react-query";
import type { useToast } from "@/hooks/use-toast";

type ToastFn = ReturnType<typeof useToast>["toast"];

/** 6.1：儲存版本後送 AI 初審（自 useAssetsWorkbench 抽出以符合檔案行數上限） */
export async function submitCreativeReviewForSavedVersion(
  savedVersionId: string,
  toast: ToastFn,
  queryClient: QueryClient,
): Promise<void> {
  try {
    const cr = await fetch("/api/creative-reviews/queue", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetVersionId: savedVersionId, reviewSource: "auto_on_upload" }),
    });
    const cj = await cr.json().catch(() => ({}));
    if (cr.ok) {
      toast({ title: "已排入審判佇列", description: "背景處理完成後會更新版本卡" });
      void queryClient.invalidateQueries({ queryKey: ["/api/creative-reviews/by-version", savedVersionId] });
    } else {
      toast({
        title: "送審失敗",
        description: (cj as { message?: string }).message ?? "請稍後在版本卡上按「送審」",
        variant: "destructive",
      });
    }
  } catch {
    toast({ title: "送審失敗", description: "網路錯誤", variant: "destructive" });
  }
}
