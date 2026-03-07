/**
 * P2-3 Prompt 設定：Boss / 投手 / 創意 三模式；已發布區、Draft（僅主 prompt）、Hidden Calibration 只讀摘要。
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
  { id: "boss", label: "Boss 模式" },
  { id: "buyer", label: "投手模式" },
  { id: "creative", label: "創意模式" },
] as const;

export default function SettingsPromptsPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<string>("boss");
  const [draftContent, setDraftContent] = useState("");

  const { data: promptData } = useQuery({
    queryKey: ["/api/workbench/prompts", mode],
    queryFn: async () => {
      const res = await fetch(`/api/workbench/prompts/${mode}`, { credentials: "include" });
      if (!res.ok) return { published: "", draft: "", publishedAt: null as string | null, publishedSummary: "" };
      return res.json();
    },
    onSuccess: (data) => {
      setDraftContent(data?.draft ?? data?.published ?? "");
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
      if (!res.ok) throw new Error("儲存失敗");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workbench/prompts", mode] }),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workbench/prompts/${mode}/publish`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("發布失敗");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workbench/prompts", mode] }),
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
        <h1 className="page-title">Prompt 設定</h1>
      </header>
      <div className="flex-1 p-4 md:p-6">
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
                  <CardTitle className="text-base">已發布</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    模式：{m.label}
                    {promptData?.publishedAt && (
                      <> · 發布時間：{new Date(promptData.publishedAt).toLocaleString("zh-TW")}</>
                    )}
                    {" · 發布者："}{" "}
                    {promptData?.publishedBy ?? "—"}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-xs font-medium text-muted-foreground mb-1">目前使用中的主 prompt 摘要（前 3 行）</p>
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
                  <CardTitle className="text-base">Draft</CardTitle>
                  <p className="text-xs text-muted-foreground">此區只編輯主 prompt，不包含 Hidden Calibration。</p>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={mode === m.id ? draftContent : ""}
                    onChange={(e) => setDraftContent(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => saveDraft.mutate(draftContent)} disabled={saveDraft.isPending}>儲存 Draft</Button>
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
                    Hidden Calibration 已啟用（只讀）
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">系統已啟用以下校準模組，一般角色不可編輯全文。</p>
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
