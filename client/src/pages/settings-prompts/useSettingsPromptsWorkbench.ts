import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useSettingsPromptsWorkbench() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<string>("boss");
  const [draftContent, setDraftContent] = useState("");
  const [draftStructured, setDraftStructured] = useState<Record<string, Record<string, unknown>>>({});
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const { data: promptData } = useQuery({
    queryKey: ["/api/workbench/prompts", mode],
    queryFn: async (): Promise<{
      published?: string;
      draft?: string;
      publishedAt?: string | null;
      publishedSummary?: string;
      draftStructured?: string | null;
      publishedStructured?: unknown;
    }> => {
      const res = await fetch(`/api/workbench/prompts/${mode}`, { credentials: "include" });
      if (!res.ok)
        return { published: "", draft: "", publishedAt: null, publishedSummary: "", draftStructured: null, publishedStructured: null };
      return res.json();
    },
  });

  useEffect(() => {
    if (!promptData) return;
    setDraftContent(promptData.draft ?? promptData.published ?? "");
    try {
      const raw = promptData.draftStructured;
      const parsed = typeof raw === "string" && raw ? JSON.parse(raw) : {};
      setDraftStructured((prev) => ({
        ...prev,
        [mode]: typeof parsed === "object" && parsed !== null ? parsed : {},
      }));
    } catch {
      setDraftStructured((prev) => ({ ...prev, [mode]: {} }));
    }
    setOverlayError(null);
  }, [promptData, mode]);

  const { data: calibrationData } = useQuery({
    queryKey: ["/api/workbench/calibration-modules"],
    queryFn: async () => {
      const res = await fetch("/api/workbench/calibration-modules", { credentials: "include" });
      if (!res.ok) return { names: [] as string[] };
      return res.json();
    },
  });
  const calibrationNames: string[] = calibrationData?.names ?? [];

  const saveDraft = useMutation({
    mutationFn: async (payload: { content: string; structuredOverlay?: string }) => {
      const res = await fetch(`/api/workbench/prompts/${mode}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: payload.content, structuredOverlay: payload.structuredOverlay ?? null }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.errorCode === "OVERLAY_PERSONA_BLOCKED") throw new Error(data?.message ?? "儲存失敗");
        throw new Error(data?.message ?? "儲存失敗");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/prompts", mode] });
      setOverlayError(null);
    },
    onError: (e: Error) => setOverlayError(e.message),
  });

  const handleSaveDraft = () => {
    const structured = draftStructured[mode];
    const structuredOverlay =
      structured && Object.keys(structured).length > 0 ? JSON.stringify(structured) : undefined;
    saveDraft.mutate({ content: draftContent, structuredOverlay });
  };

  const publish = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workbench/prompts/${mode}/publish`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.errorCode === "OVERLAY_PERSONA_BLOCKED") throw new Error(data?.message ?? "發布失敗");
        throw new Error(data?.message ?? "發布失敗");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/prompts", mode] });
      setOverlayError(null);
    },
    onError: (e: Error) => setOverlayError(e.message),
  });

  const rollback = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workbench/prompts/${mode}/rollback`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("回滾失敗");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workbench/prompts", mode] }),
  });

  return {
    mode,
    setMode,
    draftContent,
    setDraftContent,
    draftStructured,
    setDraftStructured,
    overlayError,
    setOverlayError,
    promptData,
    calibrationNames,
    saveDraft,
    handleSaveDraft,
    publish,
    rollback,
  };
}

export type SettingsPromptsWorkbench = ReturnType<typeof useSettingsPromptsWorkbench>;
