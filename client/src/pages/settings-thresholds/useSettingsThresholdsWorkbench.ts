import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT, FIELDS } from "./settings-thresholds-constants";

export function useSettingsThresholdsWorkbench() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(DEFAULT);

  const { data: published = {} } = useQuery({
    queryKey: ["/api/workbench/thresholds/published"],
    queryFn: async () => {
      const res = await fetch("/api/workbench/thresholds/published", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const { data: draftData } = useQuery({
    queryKey: ["/api/workbench/thresholds/draft"],
    queryFn: async (): Promise<Record<string, number> | null> => {
      const res = await fetch("/api/workbench/thresholds/draft", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (draftData && typeof draftData === "object") setDraft({ ...DEFAULT, ...draftData });
  }, [draftData]);

  const saveDraft = useMutation({
    mutationFn: async (config: Record<string, number>) => {
      const res = await fetch("/api/workbench/thresholds/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        credentials: "include",
      });
      if (!res.ok) throw new Error("儲存失敗");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workbench/thresholds/draft"] }),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/workbench/thresholds/publish", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("發布失敗");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/workbench/thresholds/published"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/workbench/decision-cards"] });
    },
  });

  const rollback = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/workbench/thresholds/rollback", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("回滾失敗");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/workbench/thresholds/published"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/workbench/decision-cards"] });
    },
  });

  const current = Object.keys(published).length > 0 ? (published as Record<string, number>) : DEFAULT;
  const hasDraftDiff = FIELDS.some((f) => (draft[f.key] ?? DEFAULT[f.key]) !== (current[f.key] ?? DEFAULT[f.key]));

  const extremeWarnings: string[] = [];
  const stopVal = current.spendThresholdStop ?? DEFAULT.spendThresholdStop;
  if (stopVal >= 9999)
    extremeWarnings.push("停損花費門檻設為 9999 以上，等於幾乎不自動建議停損，請確認是否為刻意設定。");
  if ((current.minSpend ?? DEFAULT.minSpend) < 200)
    extremeWarnings.push("ROI 漏斗最低花費過低（<200）易造成 Lucky 誤判，建議至少 200–300。");
  if ((current.minSpendForRules ?? DEFAULT.minSpendForRules) < 200)
    extremeWarnings.push("規則最低花費過低，小預算廣告可能被規則誤觸。");

  const applyPreset = (config: Record<string, number>) => setDraft({ ...DEFAULT, ...config });

  return {
    draft,
    setDraft,
    published: current,
    hasDraftDiff,
    extremeWarnings,
    saveDraft,
    publish,
    rollback,
    applyPreset,
  };
}

export type SettingsThresholdsWorkbench = ReturnType<typeof useSettingsThresholdsWorkbench>;
