import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { settingsSchema, type SettingsInput, type UserSettings } from "@shared/schema";
import { normalizeSettingsPayload } from "./settings-formatters";

export function useSettingsWorkbench() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("api");
  const [showPostSaveGuide, setShowPostSaveGuide] = useState(false);
  const [showFbToken, setShowFbToken] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [conservativeBudget, setConservativeBudget] = useState(false);
  const [lowConfidenceHint, setLowConfidenceHint] = useState(true);

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      ga4PropertyId: "",
      fbAccessToken: "",
      aiApiKey: "",
      systemPrompt: "",
      coreMasterPrompt: "",
      modeAPrompt: "",
      modeBPrompt: "",
      modeCPrompt: "",
      modeDPrompt: "",
      severity: "moderate",
      outputLength: "standard",
      brandTone: "professional",
      analysisBias: "conversion",
    },
    values: settings
      ? {
          ga4PropertyId: settings.ga4PropertyId,
          fbAccessToken: settings.fbAccessToken,
          aiApiKey: settings.aiApiKey,
          systemPrompt: settings.systemPrompt ?? settings.coreMasterPrompt ?? "",
          coreMasterPrompt: settings.coreMasterPrompt,
          modeAPrompt: settings.modeAPrompt,
          modeBPrompt: settings.modeBPrompt,
          modeCPrompt: settings.modeCPrompt,
          modeDPrompt: settings.modeDPrompt,
          severity: settings.severity,
          outputLength: settings.outputLength,
          brandTone: settings.brandTone,
          analysisBias: settings.analysisBias,
        }
      : undefined,
  });

  const systemPromptValue = form.watch("systemPrompt") ?? "";

  const saveMutation = useMutation({
    mutationFn: async (data: SettingsInput) => {
      const payload = normalizeSettingsPayload(data);
      const res = await apiRequest("PUT", "/api/settings", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "儲存成功", description: "所有設定已更新" });
      setShowPostSaveGuide(true);
    },
    onError: (err: Error) => {
      toast({ title: "儲存失敗", description: err?.message ?? "請稍後再試", variant: "destructive" });
    },
  });

  const apiAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleApiFieldBlur = useCallback(() => {
    if (apiAutoSaveTimerRef.current) clearTimeout(apiAutoSaveTimerRef.current);
    apiAutoSaveTimerRef.current = setTimeout(() => {
      apiAutoSaveTimerRef.current = null;
      saveMutation.mutate(form.getValues());
    }, 400);
  }, [form, saveMutation]);

  const systemPromptFileRef = useRef<HTMLInputElement>(null);
  const handleSystemPromptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (![".txt", ".md"].includes(ext)) {
      toast({ title: "檔案格式不支援", description: "僅支援 .txt 和 .md 檔案", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        form.setValue("systemPrompt", content, { shouldDirty: true });
        toast({ title: "匯入成功", description: `已將 ${file.name} 載入` });
      }
    };
    reader.onerror = () => toast({ title: "讀取失敗", description: "無法讀取檔案內容", variant: "destructive" });
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const handleSystemPromptExport = () => {
    const content = form.getValues("systemPrompt") || "";
    if (!content.trim()) {
      toast({ title: "匯出失敗", description: "目前沒有內容可匯出", variant: "destructive" });
      return;
    }
    const fileName = `ai-director-system-prompt_${new Date().toISOString().slice(0, 10)}.txt`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "匯出成功", description: `已下載 ${fileName}` });
  };

  return {
    settings,
    form,
    activeTab,
    setActiveTab,
    showPostSaveGuide,
    setShowPostSaveGuide,
    showFbToken,
    setShowFbToken,
    showAiKey,
    setShowAiKey,
    showAdvanced,
    setShowAdvanced,
    conservativeBudget,
    setConservativeBudget,
    lowConfidenceHint,
    setLowConfidenceHint,
    systemPromptValue,
    saveMutation,
    onSave: (data: SettingsInput) => saveMutation.mutate(data),
    handleApiFieldBlur,
    systemPromptFileRef,
    handleSystemPromptUpload,
    handleSystemPromptExport,
  };
}

export type SettingsWorkbench = ReturnType<typeof useSettingsWorkbench>;
