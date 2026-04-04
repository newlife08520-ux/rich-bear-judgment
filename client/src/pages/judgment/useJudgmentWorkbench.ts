import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppScope } from "@/hooks/use-app-scope";
import type { ReviewSession, ChatMessage } from "@shared/schema";
import type { Workflow } from "@shared/schema";
import {
  LAST_SESSION_KEY,
  UI_MODE_TO_WORKFLOW,
  MAX_ATTACH_SIZE_MB,
  MAX_ATTACH_SIZE,
  FILE_API_THRESHOLD,
  type PendingAttachment,
  type UIMode,
} from "./judgment-types";
import { exportFullSessionAsPdf, exportSingleMessageAsPdf } from "./judgment-report";
import { fileToBase64, parseJudgmentUrlParams } from "./judgment-workbench-utils";
import { useJudgmentWorkbenchBootstrap } from "./useJudgmentWorkbenchBootstrap";
import { useJudgmentTaskExecutionGate } from "./useJudgmentTaskExecutionGate";
import { useJudgmentCreateTaskMutation } from "./useJudgmentCreateTaskMutation";
import { useReportMetaApiError } from "@/context/meta-api-error-context";
import { mapMetaOrNetworkErrorToActionability } from "@/lib/meta-error-actionability";

const JUDGMENT_LAYOUT_KEY = "judgment_layout_mode_v1";

export function useJudgmentWorkbench() {
  const [location, setLocation] = useLocation();
  const sessionIdFromUrl = (() => {
    const match = location.match(/\?sessionId=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  })();
  const urlContext = parseJudgmentUrlParams(location);
  const { toast } = useToast();
  const reportMetaApiError = useReportMetaApiError();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [inputText, setInputText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [uiMode, setUiMode] = useState<UIMode>("creative");
  const [workflow, setWorkflow] = useState<Workflow>("clarify");
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<"focus" | "operator">(() => {
    try {
      const s = localStorage.getItem(JUDGMENT_LAYOUT_KEY);
      if (s === "operator" || s === "focus") return s;
    } catch {
      /* ignore */
    }
    return "focus";
  });
  /** Focus 預設不把「決策卡／節奏」攤在首屏；僅在顯式切到 operator 時展開工作台區塊。 */
  const [operatorWorkbenchOpen, setOperatorWorkbenchOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(JUDGMENT_LAYOUT_KEY, layoutMode);
    } catch {
      /* ignore */
    }
    if (layoutMode === "operator") setOperatorWorkbenchOpen(true);
    else setOperatorWorkbenchOpen(false);
  }, [layoutMode]);

  const scope = useAppScope();
  const {
    decisionCards,
    goalPacingByProduct,
    sessionsList,
    loadingSessions,
    sessionsLoadError,
    sessionsLoadErr,
    refetchSessions,
    fetchedSession,
    loadingSession,
  } = useJudgmentWorkbenchBootstrap(
    scope.scopeKey ?? "",
    scope.selectedAccountIds,
    sessionIdFromUrl
  );

  const createTaskMutation = useJudgmentCreateTaskMutation();

  const taskExecutionGate = useJudgmentTaskExecutionGate((body) =>
    createTaskMutation.mutateAsync(body)
  );

  const filteredSessions = historySearch.trim()
    ? sessionsList.filter((s: ReviewSession) =>
        (s.title || "").toLowerCase().includes(historySearch.trim().toLowerCase())
      )
    : sessionsList;

  useEffect(() => {
    if (fetchedSession) {
      setSession(fetchedSession);
      try {
        localStorage.setItem(LAST_SESSION_KEY, fetchedSession.id);
      } catch {}
    } else if (!sessionIdFromUrl) {
      setSession(null);
    }
  }, [fetchedSession, sessionIdFromUrl]);

  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (sessionIdFromUrl || loadingSession || hasRestoredRef.current || !sessionsList?.length) return;
    try {
      const lastId = localStorage.getItem(LAST_SESSION_KEY);
      if (lastId && sessionsList.some((s: ReviewSession) => s.id === lastId)) {
        hasRestoredRef.current = true;
        setLocation(`/judgment?sessionId=${encodeURIComponent(lastId)}`, { replace: true });
      }
    } catch {}
  }, [sessionIdFromUrl, loadingSession, sessionsList, setLocation]);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages?.length, isSubmitting, scrollToBottom]);

  const messages = session?.messages ?? [];
  const canSubmit = (inputText.trim().length > 0 || attachments.length > 0) && !isSubmitting;

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        if (file.size > MAX_ATTACH_SIZE) {
          toast({
            variant: "destructive",
            title: "檔案過大",
            description: `${file.name} 超過 ${MAX_ATTACH_SIZE_MB}MB，請縮小後再上傳`,
          });
          continue;
        }
        const isPdf = file.type === "application/pdf";
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isPdf && !isImage && !isVideo) {
          toast({
            variant: "destructive",
            title: "不支援的格式",
            description: "僅支援圖片、PDF、影片 (mp4/webm 等)",
          });
          continue;
        }
        const type: "image" | "video" | "pdf" = isPdf ? "pdf" : isVideo ? "video" : "image";
        if (file.size > FILE_API_THRESHOLD) {
          try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/content-judgment/upload-file", {
              method: "POST",
              body: form,
              credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
              toast({
                variant: "destructive",
                title: "上傳失敗",
                description: data.message || "大檔案上傳失敗，請稍後再試",
              });
              continue;
            }
            setAttachments((prev) => [
              ...prev,
              {
                id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type,
                name: file.name,
                mimeType: file.type,
                fileUri: data.fileUri,
                preview: isImage ? undefined : undefined,
              },
            ]);
          } catch (e) {
            toast({ variant: "destructive", title: "上傳失敗", description: "請檢查連線後再試" });
          }
          continue;
        }
        try {
          const dataBase64 = await fileToBase64(file);
          let preview: string | undefined;
          if (isImage) preview = `data:${file.type};base64,${dataBase64}`;
          setAttachments((prev) => [
            ...prev,
            {
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type,
              name: file.name,
              mimeType: file.type,
              dataBase64,
              preview,
            },
          ]);
        } catch (e) {
          toast({ variant: "destructive", title: "讀取失敗", description: `無法讀取 ${file.name}` });
        }
      }
    },
    [toast]
  );

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if ((!content && attachments.length === 0) || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const messageAttachments = attachments.length
      ? attachments.map((a) => ({
          type: a.type,
          mimeType: a.mimeType,
          name: a.name,
          ...(a.fileUri ? { fileUri: a.fileUri } : { data: a.dataBase64 }),
        }))
      : undefined;

    try {
      const res = await fetch("/api/content-judgment/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
          uiMode,
          workflow,
          message: {
            content: content || "（僅附檔，請總監根據附件內容審視）",
            attachments: messageAttachments,
          },
        }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg =
          (data && typeof data.message === "string" ? data.message : null) || "送出失敗，請稍後再試";
        if (data?.errorCode === "NO_API_KEY") {
          toast({
            variant: "destructive",
            title: "尚未設定 API Key",
            description: "請到「設定」頁面輸入 AI API Key（Gemini）後再試",
          });
        } else {
          reportMetaApiError(
            mapMetaOrNetworkErrorToActionability({ status: res.status, message: errMsg }),
          );
          toast({ variant: "destructive", title: "送出失敗", description: errMsg });
        }
        setSubmitError(errMsg);
        return;
      }

      setSession(data.session);
      setInputText("");
      setAttachments([]);
      if (data.workflow) setWorkflow(data.workflow);
      if (!session?.id && data.session?.id) {
        setLocation(`/judgment?sessionId=${data.session.id}`, { replace: true });
      }
    } catch (e) {
      console.error(e);
      const netMsg = e instanceof Error ? e.message : "網路錯誤，請稍後再試";
      reportMetaApiError(mapMetaOrNetworkErrorToActionability({ message: netMsg }));
      setSubmitError("網路錯誤，請稍後再試");
      toast({ variant: "destructive", title: "送出失敗", description: "請檢查連線後再試" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewChat = () => {
    try {
      localStorage.removeItem(LAST_SESSION_KEY);
    } catch {}
    setSession(null);
    setInputText("");
    setAttachments([]);
    setWorkflow("clarify");
    setSubmitError(null);
    setLocation("/judgment", { replace: true });
  };

  const handleExportFullReport = () => {
    if (!session?.messages?.length) {
      toast({ title: "尚無對話", description: "請先進行對話再匯出報告" });
      return;
    }
    exportFullSessionAsPdf(session);
  };

  const handleExportSingleReport = (msg: ChatMessage) => {
    exportSingleMessageAsPdf(msg, session?.title ?? "裁決");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) handleSend();
    }
  };

  const handleQuickPrompt = (text: string, workflowOverride?: Workflow) => {
    if (workflowOverride) setWorkflow(workflowOverride);
    setInputText(text);
    setSubmitError(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSelectSession = (s: ReviewSession) => {
    setLocation(`/judgment?sessionId=${encodeURIComponent(s.id)}`, { replace: true });
  };

  const handleModeChange = useCallback((m: UIMode) => {
    setUiMode(m);
    setWorkflow(UI_MODE_TO_WORKFLOW[m]);
  }, []);

  return {
    sessionIdFromUrl,
    urlContext,
    messagesEndRef,
    textareaRef,
    fileInputRef,
    session,
    inputText,
    setInputText,
    attachments,
    isSubmitting,
    submitError,
    historyOpen,
    setHistoryOpen,
    historySearch,
    onHistorySearchChange: setHistorySearch,
    rightPanelOpen,
    setRightPanelOpen,
    uiMode,
    setUiMode,
    workflow,
    setWorkflow,
    selectedSubtype,
    setSelectedSubtype,
    scope,
    decisionCards,
    goalPacingByProduct,
    loadingSessions,
    sessionsList: filteredSessions,
    sessionsListUnfiltered: sessionsList,
    loadingSession,
    sessionsLoadError,
    sessionsLoadErr,
    refetchSessions,
    messages,
    canSubmit,
    addFiles,
    removeAttachment,
    handleSend,
    handleNewChat,
    handleExportFullReport,
    handleExportSingleReport,
    handleCreateTaskFromJudgment: taskExecutionGate.handleCreateTaskFromJudgment,
    judgmentExecGateOpen: taskExecutionGate.judgmentExecGateOpen,
    onJudgmentExecGateOpenChange: taskExecutionGate.onJudgmentExecGateOpenChange,
    judgmentExecGate: taskExecutionGate.judgmentExecGate,
    confirmJudgmentTaskCreate: taskExecutionGate.confirmJudgmentTaskCreate,
    judgmentExecConfirmError: taskExecutionGate.judgmentExecConfirmError,
    judgmentExecGateConfirming: taskExecutionGate.judgmentExecGateConfirming,
    handleKeyDown,
    handleQuickPrompt,
    handleSelectSession,
    handleModeChange,
    layoutMode,
    setLayoutMode,
    operatorWorkbenchOpen,
    setOperatorWorkbenchOpen,
  };
}
