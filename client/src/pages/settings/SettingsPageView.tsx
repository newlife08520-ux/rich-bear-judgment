import { Link } from "wouter";
import {
  Eye,
  EyeOff,
  Save,
  BarChart3,
  Brain,
  Cpu,
  Upload,
  Download,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CURRENT_AI_MODEL } from "./settings-constants";
import { buildInitialResultFromSettings } from "./settings-formatters";
import type { SettingsWorkbench } from "./useSettingsWorkbench";
import { SettingsOverviewSection } from "./widgets/SettingsOverviewSection";
import { SettingsPreferencesCard } from "./widgets/SettingsPreferencesCard";
import { SettingsApiConnectionSection } from "./widgets/SettingsApiConnectionSection";
import { SettingsSyncStatusBlock } from "./widgets/SettingsSyncStatusBlock";
import { SettingsPromptStats } from "./widgets/SettingsPromptStats";
import { SettingsPipelineDebugPanel } from "./widgets/SettingsPipelineDebugPanel";
import { SettingsMyProductScopeCard } from "./widgets/SettingsMyProductScopeCard";

export function SettingsPageView({ wb }: { wb: SettingsWorkbench }) {
  const {
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
    onSave,
    handleApiFieldBlur,
    systemPromptFileRef,
    handleSystemPromptUpload,
    handleSystemPromptExport,
  } = wb;

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <h1 className="text-lg font-bold" data-testid="text-page-title">
            設定中心
          </h1>
        </div>
      </header>

      <div className="min-h-full p-4">
        <div className="page-container-reading">
          <SettingsOverviewSection />

          <SettingsMyProductScopeCard />

          <form onSubmit={form.handleSubmit(onSave)}>
            <SettingsPreferencesCard
              form={form}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              conservativeBudget={conservativeBudget}
              setConservativeBudget={setConservativeBudget}
              lowConfidenceHint={lowConfidenceHint}
              setLowConfidenceHint={setLowConfidenceHint}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6" data-testid="tabs-settings">
                <TabsTrigger value="api" data-testid="tab-api-binding">
                  API 綁定
                </TabsTrigger>
                <TabsTrigger value="prompt" data-testid="tab-ai-prompt">
                  AI 主腦
                </TabsTrigger>
                <TabsTrigger value="debug" data-testid="tab-debug">
                  Pipeline 狀態
                </TabsTrigger>
              </TabsList>

              <TabsContent value="api">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">API 綁定設定</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      變更後離開欄位會自動儲存，無需手動按「儲存所有設定」
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6" data-testid="form-api-settings">
                    <div className="space-y-2.5">
                      <Label htmlFor="ga4PropertyId">GA4 Property ID</Label>
                      <Input
                        id="ga4PropertyId"
                        placeholder="例如：123456789"
                        {...form.register("ga4PropertyId", { onBlur: handleApiFieldBlur })}
                        data-testid="input-ga4-property-id"
                      />
                      <SettingsApiConnectionSection
                        type="ga4"
                        label="GA4"
                        getValue={() => form.getValues("ga4PropertyId") || ""}
                        initialResult={buildInitialResultFromSettings("ga4", settings)}
                      />
                    </div>
                    <div className="border-t" />
                    <div className="space-y-2.5">
                      <Label htmlFor="fbAccessToken">FB Access Token</Label>
                      <div className="relative">
                        <Input
                          id="fbAccessToken"
                          type={showFbToken ? "text" : "password"}
                          placeholder="輸入 Facebook API 存取權杖"
                          {...form.register("fbAccessToken", { onBlur: handleApiFieldBlur })}
                          data-testid="input-fb-access-token"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowFbToken(!showFbToken)}
                          data-testid="button-toggle-fb-token"
                        >
                          {showFbToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <SettingsApiConnectionSection
                        type="fb"
                        label="Facebook"
                        getValue={() => form.getValues("fbAccessToken") || ""}
                        initialResult={buildInitialResultFromSettings("fb", settings)}
                      />
                    </div>
                    <div className="border-t" />
                    <div className="space-y-2.5">
                      <Label htmlFor="aiApiKey">AI Model API Key</Label>
                      <div className="relative">
                        <Input
                          id="aiApiKey"
                          type={showAiKey ? "text" : "password"}
                          placeholder="輸入 AI 模型 API 金鑰"
                          {...form.register("aiApiKey", { onBlur: handleApiFieldBlur })}
                          data-testid="input-ai-api-key"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowAiKey(!showAiKey)}
                          data-testid="button-toggle-ai-key"
                        >
                          {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Cpu className="w-3 h-3" />
                        <span>
                          目前指定模型: <span className="font-semibold text-foreground">{CURRENT_AI_MODEL}</span>
                        </span>
                      </div>
                      <SettingsApiConnectionSection
                        type="ai"
                        label="AI Model"
                        getValue={() => form.getValues("aiApiKey") || ""}
                        showModel
                        initialResult={buildInitialResultFromSettings("ai", settings)}
                      />
                    </div>
                    <div className="border-t pt-4 mt-4" id="sync-account-block">
                      <p className="text-xs font-medium text-muted-foreground mb-2">資料同步狀態</p>
                      <SettingsSyncStatusBlock />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="prompt">
                <Card data-testid="form-prompt-settings">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      AI 總監核心大腦 (System Prompt)
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      將整包 V15 或自訂的 System Prompt 貼入下方，內容判讀對話工作區會以此作為 AI 的單一 System
                      Instruction，由模型自動判斷情境與模式。
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <input
                      ref={systemPromptFileRef}
                      type="file"
                      accept=".txt,.md"
                      className="hidden"
                      onChange={handleSystemPromptUpload}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => systemPromptFileRef.current?.click()}
                        data-testid="button-upload-system-prompt"
                      >
                        <Upload className="w-3 h-3" />
                        匯入 .txt / .md
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleSystemPromptExport}
                        data-testid="button-export-system-prompt"
                      >
                        <Download className="w-3 h-3" />
                        匯出
                      </Button>
                    </div>
                    <Textarea
                      {...form.register("systemPrompt")}
                      rows={20}
                      placeholder="貼上完整的 AI 總監 System Prompt（例如 V15 審判官／王牌行銷總監人格）..."
                      className="font-mono text-sm leading-relaxed min-h-[320px]"
                      data-testid="textarea-system-prompt"
                    />
                    <SettingsPromptStats text={systemPromptValue} label="system" />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="debug">
                <SettingsPipelineDebugPanel />
              </TabsContent>

              <div className="mt-6">
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="gap-2"
                  data-testid="button-save-settings"
                >
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? "儲存中..." : "儲存所有設定"}
                </Button>
              </div>
              {showPostSaveGuide && (
                <Card className="mt-4 border-primary/30 bg-primary/5" data-testid="card-post-save-guide">
                  <CardContent className="pt-4 pb-4">
                    <p className="font-medium text-sm mb-2">設定已儲存。下一步：</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      請先「立即同步帳號」取得帳號列表，再至首頁點「更新資料」產生決策數據。
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setActiveTab("api");
                          setTimeout(() => {
                            document.getElementById("sync-account-block")?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                          }, 100);
                        }}
                        data-testid="button-guide-sync"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        立即同步帳號
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <Link href="/" data-testid="button-guide-dashboard">
                          <BarChart3 className="w-3.5 h-3.5" />
                          前往首頁更新資料
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPostSaveGuide(false)}
                        data-testid="button-guide-dismiss"
                      >
                        知道了
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </Tabs>
          </form>
        </div>
      </div>
    </div>
  );
}
