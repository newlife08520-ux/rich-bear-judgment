import { useState, useRef, useMemo } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Save,
  Shield,
  BarChart3,
  Plug,
  Loader2,
  Sliders,
  Brain,
  Target,
  Palette,
  Upload,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  Tag,
  Type,
  Hash,
  Coins,
  Sparkles,
  ShoppingCart,
  Megaphone,
  TrendingDown,
  Cpu,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Gauge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { settingsSchema, type SettingsInput, type UserSettings, type RefreshStatus, type SyncedAccount } from "@shared/schema";

const TOKEN_WARNING_THRESHOLD = 8000;

function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
  const nonCjk = text.length - cjkCount;
  return Math.round(cjkCount * 1.5 + nonCjk / 4);
}

type ConnectionStatus = "idle" | "testing" | "success" | "error";

interface ConnectionResult {
  status: ConnectionStatus;
  message: string;
  checkedAt: string | null;
  testedModel?: string;
  accountPreview?: { totalCount: number; topNames: string[] };
}

const STATUS_LAMP_COLORS: Record<ConnectionStatus, string> = {
  idle: "bg-gray-300",
  testing: "bg-yellow-400 animate-pulse",
  success: "bg-emerald-500",
  error: "bg-red-500",
};

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: "尚未驗證",
  testing: "驗證中",
  success: "驗證成功",
  error: "驗證失敗",
};

const CURRENT_AI_MODEL = "gemini-3.1-pro-preview";

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "剛剛";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function StatusLamp({ status }: { status: ConnectionStatus }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_LAMP_COLORS[status]}`}
      data-testid="status-lamp"
    />
  );
}

function ApiConnectionSection({
  type,
  label,
  getValue,
  showModel,
}: {
  type: string;
  label: string;
  getValue: () => string;
  showModel?: boolean;
}) {
  const { toast } = useToast();
  const [result, setResult] = useState<ConnectionResult>({
    status: "idle",
    message: "",
    checkedAt: null,
  });

  const handleTest = async () => {
    const value = getValue();
    if (!value.trim()) {
      const emptyHints: Record<string, string> = {
        ai: "尚未輸入 API Key，請先輸入 AI 模型的 API 金鑰",
        fb: "尚未輸入 Access Token，請先輸入 Facebook API 存取權杖",
        ga4: "尚未輸入 Property ID，請先輸入 GA4 資源 ID",
      };
      setResult({ status: "error", message: emptyHints[type] || "欄位不能為空", checkedAt: new Date().toISOString() });
      toast({ title: "無法驗證", description: emptyHints[type] || "請先輸入對應欄位值", variant: "destructive" });
      return;
    }
    setResult((prev) => ({ ...prev, status: "testing", message: "" }));
    try {
      const res = await apiRequest("POST", "/api/settings/test-connection", { type, value });
      const data = await res.json();
      setResult({
        status: data.success ? "success" : "error",
        message: data.message || (data.success ? "連線成功" : "連線失敗"),
        checkedAt: data.checkedAt || new Date().toISOString(),
        testedModel: data.testedModel,
        accountPreview: data.accountPreview,
      });
      if (data.success) {
        toast({ title: "連線成功", description: data.message });
      } else {
        toast({ title: "驗證失敗", description: data.message, variant: "destructive" });
      }
    } catch {
      const checkedAt = new Date().toISOString();
      setResult({ status: "error", message: "網路錯誤或伺服器無回應，請檢查連線狀態", checkedAt });
      toast({ title: "連線失敗", description: "無法連線至伺服器，請稍後再試", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2" data-testid={`connection-section-${type}`}>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={result.status === "testing"} className="gap-1.5 shrink-0" data-testid={`button-test-${type}`}>
          {result.status === "testing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
          {result.status === "testing" ? "驗證中..." : "測試連線"}
        </Button>
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusLamp status={result.status} />
          <span className={`text-xs truncate ${result.status === "success" ? "text-emerald-700" : result.status === "error" ? "text-red-600" : result.status === "testing" ? "text-yellow-600" : "text-muted-foreground"}`} data-testid={`status-text-${type}`}>
            {STATUS_LABELS[result.status]}
          </span>
          {result.checkedAt && result.status !== "testing" && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0" data-testid={`status-time-${type}`}>
              <Clock className="w-3 h-3" />
              {formatTimeAgo(result.checkedAt)}
            </span>
          )}
        </div>
      </div>
      {showModel && result.testedModel && (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground pl-0.5" data-testid={`tested-model-${type}`}>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3" />
            <span>快速驗證模型: <span className="font-semibold text-foreground">{result.testedModel}</span></span>
          </div>
          <div className="flex items-center gap-1.5 pl-[18px]">
            <span>正式審判模型: <span className="font-semibold text-foreground">{CURRENT_AI_MODEL}</span></span>
          </div>
        </div>
      )}
      {type === "fb" && result.status === "success" && result.accountPreview && (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground pl-0.5" data-testid="fb-account-preview">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3" />
            <span>可用廣告帳號: <span className="font-semibold text-foreground">{result.accountPreview.totalCount} 個</span></span>
          </div>
          {result.accountPreview.topNames.length > 0 && (
            <div className="flex items-center gap-1.5 pl-[18px]">
              <span>
                {result.accountPreview.topNames.join("、")}
                {result.accountPreview.totalCount > 3 ? "..." : ""}
              </span>
            </div>
          )}
        </div>
      )}
      {type === "ga4" && result.status === "error" && result.message?.includes("尚未設定") && (
        <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-md px-2.5 py-1.5" data-testid={`ga4-auth-hint`}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>GA4 驗證需要 Service Account 憑證。請在環境變數中設定 GOOGLE_SERVICE_ACCOUNT_KEY。</span>
        </div>
      )}
      {result.status === "success" && result.message && (
        <div className="flex items-start gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-md px-2.5 py-1.5" data-testid={`status-detail-${type}`}>
          <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{result.message}</span>
        </div>
      )}
      {result.status === "error" && result.message && (
        <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-md px-2.5 py-1.5" data-testid={`status-error-${type}`}>
          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}

function PromptStats({ text, label }: { text: string; label?: string }) {
  const stats = useMemo(() => {
    const charCount = text.length;
    const lineCount = text ? text.split("\n").length : 0;
    const tokens = estimateTokens(text);
    return { charCount, lineCount, tokens };
  }, [text]);

  const isOverThreshold = stats.tokens > TOKEN_WARNING_THRESHOLD;

  return (
    <div className="flex items-center gap-4 flex-wrap" data-testid={`prompt-stats${label ? `-${label}` : ""}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Type className="w-3 h-3" />
        <span>字數: <span className="font-semibold text-foreground" data-testid={`stat-char-count${label ? `-${label}` : ""}`}>{stats.charCount.toLocaleString()}</span></span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Hash className="w-3 h-3" />
        <span>行數: <span className="font-semibold text-foreground">{stats.lineCount}</span></span>
      </div>
      <div className={`flex items-center gap-1.5 text-xs ${isOverThreshold ? "text-amber-600" : "text-muted-foreground"}`}>
        <Coins className="w-3 h-3" />
        <span>預估 tokens: <span className={`font-semibold ${isOverThreshold ? "text-amber-700" : "text-foreground"}`} data-testid={`stat-tokens${label ? `-${label}` : ""}`}>{stats.tokens.toLocaleString()}</span></span>
        {isOverThreshold && (
          <Badge variant="secondary" className="text-[10px] text-amber-700 bg-amber-100 ml-1">
            <AlertTriangle className="w-3 h-3 mr-0.5" />
            偏長
          </Badge>
        )}
      </div>
    </div>
  );
}

function CollapsiblePromptBlock({
  id,
  label,
  icon: Icon,
  description,
  value,
  onChange,
  placeholder,
  onFileUpload,
  onExport,
  accentColor,
  defaultOpen,
}: {
  id: string;
  label: string;
  icon: any;
  description: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  accentColor: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card data-testid={`block-${id}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left cursor-pointer"
        data-testid={`button-toggle-${id}`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accentColor}`} />
          <span className="font-semibold text-sm">{label}</span>
          <Badge variant="secondary" className="text-[10px]">
            {estimateTokens(value).toLocaleString()} tokens
          </Badge>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">{description}</p>
          <div className="flex items-center justify-end gap-2">
            <input ref={fileRef} type="file" accept=".txt,.md" className="hidden" onChange={onFileUpload} />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} data-testid={`button-upload-${id}`}>
              <Upload className="w-3 h-3" />
              匯入
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onExport} data-testid={`button-export-${id}`}>
              <Download className="w-3 h-3" />
              匯出
            </Button>
          </div>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            placeholder={placeholder}
            className="font-mono text-sm leading-relaxed"
            data-testid={`textarea-${id}`}
          />
          <PromptStats text={value} label={id} />
        </div>
      )}
    </Card>
  );
}

function PipelineDebugPanel() {
  const { data: refreshStatus } = useQuery<RefreshStatus>({
    queryKey: ["/api/refresh/status"],
  });

  const { data: syncedData } = useQuery<{ accounts: SyncedAccount[] }>({
    queryKey: ["/api/accounts/synced"],
  });

  const { data: summaryData } = useQuery<{ hasSummary: boolean; summary?: any }>({
    queryKey: ["/api/dashboard/cross-account-summary"],
  });

  const accounts = syncedData?.accounts || [];
  const metaAccounts = accounts.filter(a => a.platform === "meta");
  const ga4Accounts = accounts.filter(a => a.platform === "ga4");
  const summary = summaryData?.summary;

  const fmtTs = (ts: string | null | undefined) => {
    if (!ts) return "尚未執行";
    const d = new Date(ts);
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getDate().toString().padStart(2,"0")} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
  };

  const rows: { label: string; value: string; status?: "ok" | "warn" | "error" }[] = [
    { label: "Meta 廣告帳號數", value: `${metaAccounts.length} 個`, status: metaAccounts.length > 0 ? "ok" : "warn" },
    { label: "GA4 Property 數", value: `${ga4Accounts.length} 個`, status: ga4Accounts.length > 0 ? "ok" : "warn" },
    { label: "最後數據擷取時間", value: fmtTs(refreshStatus?.lastRefreshedAt), status: refreshStatus?.lastRefreshedAt ? "ok" : "warn" },
    { label: "最後分析時間", value: fmtTs(refreshStatus?.lastAnalysisAt), status: refreshStatus?.lastAnalysisAt ? "ok" : "warn" },
    { label: "最後 AI 摘要時間", value: fmtTs(refreshStatus?.lastAiSummaryAt), status: refreshStatus?.lastAiSummaryAt ? "ok" : "warn" },
    { label: "Analysis Batch ID", value: summary?.analysisBatchId || "N/A" },
    { label: "AI 模型", value: summary?.aiModelUsed || "N/A" },
    { label: "數據涵蓋範圍", value: summary?.dataScope === "both" ? "Meta + GA4" : summary?.dataScope === "meta_only" ? "僅 Meta" : summary?.dataScope === "ga4_only" ? "僅 GA4" : "無數據" },
    { label: "Pipeline 狀態", value: refreshStatus?.isRefreshing ? `執行中: ${refreshStatus.currentStep} (${refreshStatus.progress}%)` : "閒置", status: refreshStatus?.isRefreshing ? "warn" : "ok" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Pipeline 觀測面板
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          檢視數據擷取、分析引擎、AI 摘要產生的完整狀態。
        </p>
      </CardHeader>
      <CardContent className="space-y-1" data-testid="section-debug-panel">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2 py-2 border-b last:border-0" data-testid={`debug-row-${idx}`}>
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{row.value}</span>
              {row.status === "ok" && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
              {row.status === "warn" && <Clock className="w-3.5 h-3.5 text-amber-500" />}
              {row.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
            </div>
          </div>
        ))}
        {metaAccounts.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">已同步的 Meta 帳號 (前 5 個)</p>
            <div className="space-y-1">
              {metaAccounts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs py-1">
                  <span>{a.accountName}</span>
                  <Badge variant="secondary" className="text-xs">{a.status === "active" ? "啟用中" : "已停用"}</Badge>
                </div>
              ))}
              {metaAccounts.length > 5 && <p className="text-xs text-muted-foreground">... 還有 {metaAccounts.length - 5} 個帳號</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PillToggleGroup({
  label,
  icon: Icon,
  iconColor,
  description,
  options,
  value,
  onChange,
  testIdPrefix,
}: {
  label: string;
  icon: any;
  iconColor: string;
  description: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-2" data-testid={`pills-${testIdPrefix}`}>
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={value === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(opt.value)}
            data-testid={`pill-${testIdPrefix}-${opt.value}`}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("api");
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
      const res = await apiRequest("PUT", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "儲存成功", description: "所有設定已更新" });
    },
    onError: () => {
      toast({ title: "儲存失敗", description: "請稍後再試", variant: "destructive" });
    },
  });

  const onSave = (data: SettingsInput) => {
    saveMutation.mutate(data);
  };

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
    reader.onerror = () => {
      toast({ title: "讀取失敗", description: "無法讀取檔案內容", variant: "destructive" });
    };
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

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <h1 className="text-lg font-bold" data-testid="text-page-title">設定中心</h1>
        </div>
      </header>

      <div className="min-h-full p-4">
        <div className="page-container-reading">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">管理工具</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">低頻設定與資料修正，非日常主流程</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href="/mapping">資料歸因修正</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/thresholds">門檻設定</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/prompts">Prompt 設定</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/team">團隊權限</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/history">判讀紀錄</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/fb-ads">FB 帳號分析</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/ga4">GA 頁面分析</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">AI 作戰設定</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">門檻與 Prompt 版本化、發布與回滾</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/thresholds">門檻設定</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/prompts">Prompt 設定</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                角色工作流
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">依角色建議每天看的 4 個核心頁面</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-semibold text-sm">老闆每天看</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li><Link href="/" className="text-primary hover:underline">今日決策中心</Link></li>
                    <li><Link href="/judgment" className="text-primary hover:underline">RICH BEAR 審判官</Link></li>
                    <li><Link href="/scorecard" className="text-primary hover:underline">成功率成績單</Link></li>
                    <li><Link href="/products" className="text-primary hover:underline">商品作戰室</Link></li>
                  </ul>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-semibold text-sm">投手每天看</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li><Link href="/" className="text-primary hover:underline">今日決策中心</Link></li>
                    <li><Link href="/judgment" className="text-primary hover:underline">RICH BEAR 審判官</Link></li>
                    <li><Link href="/ga4-analysis" className="text-primary hover:underline">GA4 頁面分析</Link></li>
                    <li><Link href="/products" className="text-primary hover:underline">商品作戰室</Link></li>
                  </ul>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-semibold text-sm">素材／企劃每天看</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li><Link href="/creative-lifecycle" className="text-primary hover:underline">素材生命週期</Link></li>
                    <li><Link href="/judgment" className="text-primary hover:underline">RICH BEAR 審判官</Link></li>
                    <li><Link href="/assets" className="text-primary hover:underline">素材中心</Link></li>
                    <li><Link href="/scorecard" className="text-primary hover:underline">成功率成績單</Link></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <form onSubmit={form.handleSubmit(onSave)}>
            <Card className="mb-6" data-testid="section-preferences">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  偏好設定
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  調整 AI 審判的方向、深度與語氣
                </p>
              </CardHeader>
              <CardContent className="space-y-5" data-testid="form-preferences">
                <PillToggleGroup
                  label="目的"
                  icon={Target}
                  iconColor="text-emerald-500"
                  description="AI 會根據目的調整分析重點"
                  options={[
                    { value: "conversion", label: "賣貨" },
                    { value: "brand", label: "品牌" },
                  ]}
                  value={form.watch("analysisBias")}
                  onChange={(v) => form.setValue("analysisBias", v as any, { shouldDirty: true })}
                  testIdPrefix="bias"
                />

                <div className="border-t" />

                <PillToggleGroup
                  label="深度"
                  icon={BarChart3}
                  iconColor="text-blue-500"
                  description="決定報告的詳細程度"
                  options={[
                    { value: "summary", label: "快速" },
                    { value: "standard", label: "標準" },
                    { value: "detailed", label: "完整" },
                  ]}
                  value={form.watch("outputLength")}
                  onChange={(v) => form.setValue("outputLength", v as any, { shouldDirty: true })}
                  testIdPrefix="depth"
                />

                <div className="border-t" />

                <PillToggleGroup
                  label="語氣"
                  icon={Palette}
                  iconColor="text-violet-500"
                  description="AI 說話的風格"
                  options={[
                    { value: "professional", label: "專業" },
                    { value: "direct", label: "直接" },
                    { value: "friendly", label: "親切" },
                  ]}
                  value={form.watch("brandTone")}
                  onChange={(v) => form.setValue("brandTone", v as any, { shouldDirty: true })}
                  testIdPrefix="tone"
                />

                <div className="border-t" />

                <div data-testid="section-advanced-preferences">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between py-1 text-left cursor-pointer"
                    data-testid="button-toggle-advanced-prefs"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Sliders className="w-3.5 h-3.5" />
                      進階調校
                      <Badge variant="secondary" className="text-[10px]">選填</Badge>
                    </div>
                    {showAdvanced ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {showAdvanced && (
                    <div className="mt-4 space-y-5">
                      <PillToggleGroup
                        label="嚴格度"
                        icon={Shield}
                        iconColor="text-red-500"
                        description="控制 AI 審判的標準高低"
                        options={[
                          { value: "lenient", label: "寬鬆" },
                          { value: "moderate", label: "適中" },
                          { value: "strict", label: "嚴格" },
                        ]}
                        value={form.watch("severity")}
                        onChange={(v) => form.setValue("severity", v as any, { shouldDirty: true })}
                        testIdPrefix="severity"
                      />

                      <div className="border-t" />

                      <div className="space-y-2" data-testid="pills-confidence">
                        <Label className="flex items-center gap-2 text-sm font-medium">
                          <Gauge className="w-4 h-4 text-amber-500" />
                          Confidence 門檻
                        </Label>
                        <p className="text-xs text-muted-foreground">數據量不足時，AI 會自動降低信心分數</p>
                        <div className="flex gap-2">
                          {[
                            { value: "low", label: "低（寬鬆）" },
                            { value: "medium", label: "中" },
                            { value: "high", label: "高（嚴謹）" },
                          ].map((opt) => (
                            <Button
                              key={opt.value}
                              type="button"
                              variant="outline"
                              size="sm"
                              className={opt.value === "medium" ? "toggle-elevate toggle-elevated" : ""}
                              data-testid={`pill-confidence-${opt.value}`}
                            >
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="border-t" />

                      <div className="space-y-4">
                        <Label className="flex items-center gap-2 text-sm font-medium">
                          <Info className="w-4 h-4 text-blue-500" />
                          其他偏好
                        </Label>
                        <div className="space-y-4 text-sm">
                          <div className="flex items-center justify-between gap-3" data-testid="toggle-conservative-budget">
                            <div>
                              <p className="font-medium">保守預算建議</p>
                              <p className="text-xs text-muted-foreground">預算建議偏保守，加量前先觀察</p>
                            </div>
                            <Switch
                              checked={conservativeBudget}
                              onCheckedChange={setConservativeBudget}
                              data-testid="switch-conservative-budget"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3" data-testid="toggle-low-confidence-hint">
                            <div>
                              <p className="font-medium">低信心提示</p>
                              <p className="text-xs text-muted-foreground">數據不足時額外標記提醒</p>
                            </div>
                            <Switch
                              checked={lowConfidenceHint}
                              onCheckedChange={setLowConfidenceHint}
                              data-testid="switch-low-confidence-hint"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6" data-testid="tabs-settings">
                <TabsTrigger value="api" data-testid="tab-api-binding">API 綁定</TabsTrigger>
                <TabsTrigger value="prompt" data-testid="tab-ai-prompt">AI 主腦</TabsTrigger>
                <TabsTrigger value="debug" data-testid="tab-debug">Pipeline 狀態</TabsTrigger>
              </TabsList>

              <TabsContent value="api">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">API 綁定設定</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6" data-testid="form-api-settings">
                    <div className="space-y-2.5">
                      <Label htmlFor="ga4PropertyId">GA4 Property ID</Label>
                      <Input id="ga4PropertyId" placeholder="例如：123456789" {...form.register("ga4PropertyId")} data-testid="input-ga4-property-id" />
                      <ApiConnectionSection type="ga4" label="GA4" getValue={() => form.getValues("ga4PropertyId") || ""} />
                    </div>
                    <div className="border-t" />
                    <div className="space-y-2.5">
                      <Label htmlFor="fbAccessToken">FB Access Token</Label>
                      <div className="relative">
                        <Input id="fbAccessToken" type={showFbToken ? "text" : "password"} placeholder="輸入 Facebook API 存取權杖" {...form.register("fbAccessToken")} data-testid="input-fb-access-token" />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowFbToken(!showFbToken)} data-testid="button-toggle-fb-token">
                          {showFbToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <ApiConnectionSection type="fb" label="Facebook" getValue={() => form.getValues("fbAccessToken") || ""} />
                    </div>
                    <div className="border-t" />
                    <div className="space-y-2.5">
                      <Label htmlFor="aiApiKey">AI Model API Key</Label>
                      <div className="relative">
                        <Input id="aiApiKey" type={showAiKey ? "text" : "password"} placeholder="輸入 AI 模型 API 金鑰" {...form.register("aiApiKey")} data-testid="input-ai-api-key" />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowAiKey(!showAiKey)} data-testid="button-toggle-ai-key">
                          {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Cpu className="w-3 h-3" />
                        <span>目前指定模型: <span className="font-semibold text-foreground">{CURRENT_AI_MODEL}</span></span>
                      </div>
                      <ApiConnectionSection type="ai" label="AI Model" getValue={() => form.getValues("aiApiKey") || ""} showModel />
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
                      將整包 V15 或自訂的 System Prompt 貼入下方，內容判讀對話工作區會以此作為 AI 的單一 System Instruction，由模型自動判斷情境與模式。
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
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => systemPromptFileRef.current?.click()} data-testid="button-upload-system-prompt">
                        <Upload className="w-3 h-3" />
                        匯入 .txt / .md
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleSystemPromptExport} data-testid="button-export-system-prompt">
                        <Download className="w-3 h-3" />
                        匯出
                      </Button>
                    </div>
                    <Textarea
                      {...form.register("systemPrompt")}
                      rows={20}
                      placeholder="貼上完整的 AI 總監 System Prompt（例如 V15 華麗熊王牌行銷總監）..."
                      className="font-mono text-sm leading-relaxed min-h-[320px]"
                      data-testid="textarea-system-prompt"
                    />
                    <PromptStats text={systemPromptValue} label="system" />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="debug">
                <PipelineDebugPanel />
              </TabsContent>

              <div className="mt-6">
                <Button type="submit" disabled={saveMutation.isPending} className="gap-2" data-testid="button-save-settings">
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? "儲存中..." : "儲存所有設定"}
                </Button>
              </div>
            </Tabs>
          </form>
        </div>
      </div>
    </div>
  );
}
