/**
 * 角色視角補充 Overlay 設定頁
 * Boss / 投手 / 創意 三種視角；僅編輯「該視角下的補充偏好、輸出規則、呈現優先順序」。
 * 不覆蓋核心人格，不包含 Hidden Calibration。
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, RotateCcw, Lock } from "lucide-react";

const MODES = [
  { id: "boss", label: "Boss 視角" },
  { id: "buyer", label: "投手視角" },
  { id: "creative", label: "創意視角" },
] as const;

const MODE_OVERLAY_HINTS: Record<string, string> = {
  boss: "例：摘要先排風險與金額、建議動作優先、商業結論風格與長短。",
  buyer: "例：哪張表先看、rescue/scale 資訊是否預設展開、排序偏好、whyNotMore 呈現方式。",
  creative: "例：先看鉤子/前 3 秒/首圖/字幕、先給 3 方向或 1 完整版、輸出偏向創作或改稿建議。",
};

export default function SettingsPromptsPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<string>("boss");
  const [draftContent, setDraftContent] = useState("");
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const { data: promptData } = useQuery({
    queryKey: ["/api/workbench/prompts", mode],
    queryFn: async () => {
      const res = await fetch(`/api/workbench/prompts/${mode}`, { credentials: "include" });
      if (!res.ok) return { published: "", draft: "", publishedAt: null as string | null, publishedSummary: "" };
      return res.json();
    },
    onSuccess: (data) => {
      setDraftContent(data?.draft ?? data?.published ?? "");
      setOverlayError(null);
    },
  });

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
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/workbench/prompts/${mode}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
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

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center gap-3 p-4 border-b shrink-0">
        <SidebarTrigger />
        <h1 className="page-title">角色視角補充 Overlay</h1>
      </header>
      <div className="flex-1 p-4 md:p-6">
        <p className="text-sm text-muted-foreground mb-4">
          此頁設定三種視角（Boss / 投手 / 創意）下的「補充偏好與輸出規則」，不會覆蓋核心人格，也不包含 Hidden Calibration。僅作為該視角下的呈現優先順序與輸出偏向。
        </p>
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList>
            {MODES.map((m) => (
              <TabsTrigger key={m.id} value={m.id}>{m.label}</TabsTrigger>
            ))}
          </TabsList>
          {MODES.map((m) => (
            <TabsContent key={m.id} value={m.id} className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">目前使用中的 Overlay（已發布）</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    視角：{m.label}
                    {promptData?.publishedAt && (
                      <> · 發布時間：{new Date(promptData.publishedAt).toLocaleString("zh-TW")}</>
                    )}
                    {" · 發布者："}{" "}
                    {promptData?.publishedBy ?? "—"}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-xs font-medium text-muted-foreground mb-1">摘要（前 3 行）</p>
                  <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                    {promptData?.publishedSummary || "（尚無已發布內容）"}
                  </pre>
                  <Button type="button" variant="outline" size="sm" className="mt-2 gap-1" onClick={() => rollback.mutate()} disabled={rollback.isPending}>
                    <RotateCcw className="w-3 h-3" /> 回滾
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Overlay 草稿（視角補充）</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    僅編輯「{m.label}」的視角補充與輸出偏向，不可填寫人格定義、最高任務、分數哲學、Hidden Calibration 等。{MODE_OVERLAY_HINTS[m.id]}
                  </p>
                </CardHeader>
                <CardContent>
                  {overlayError && (
                    <div className="text-sm text-destructive mb-2 rounded bg-destructive/10 p-2">{overlayError}</div>
                  )}
                  <Textarea
                    value={mode === m.id ? draftContent : ""}
                    onChange={(e) => { setDraftContent(e.target.value); setOverlayError(null); }}
                    rows={8}
                    className="font-mono text-sm"
                    placeholder="例：此視角下優先顯示風險與金額；建議動作列在第一段；摘要控制在 3 行內。"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => saveDraft.mutate(draftContent)} disabled={saveDraft.isPending}>儲存草稿</Button>
                    <Button size="sm" variant="default" className="gap-1" onClick={() => publish.mutate()} disabled={publish.isPending}>
                      <Upload className="w-3 h-3" /> 發布
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    Hidden Calibration（只讀，不可由此頁修改）
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">校準層由系統固定，不包含在 Overlay 編輯範圍內。以下為目前已啟用模組名稱。</p>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {calibrationNames.length > 0 ? calibrationNames.map((name, i) => (
                      <li key={i}>{name}</li>
                    )) : (
                      <li>載入中…</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
