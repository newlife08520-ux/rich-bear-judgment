import { useState, useEffect } from "react";
import {
  Plug,
  Loader2,
  Clock,
  Cpu,
  Building2,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CURRENT_AI_MODEL, STATUS_LAMP_COLORS, STATUS_LABELS } from "../settings-constants";
import { formatTimeAgo } from "../settings-formatters";
import type { ConnectionResult, ConnectionStatus } from "../settings-types";

function StatusLamp({ status }: { status: ConnectionStatus }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_LAMP_COLORS[status]}`}
      data-testid="status-lamp"
    />
  );
}

export function SettingsApiConnectionSection({
  type,
  label,
  getValue,
  showModel,
  initialResult,
}: {
  type: string;
  label: string;
  getValue: () => string;
  showModel?: boolean;
  initialResult?: ConnectionResult;
}) {
  const { toast } = useToast();
  const [result, setResult] = useState<ConnectionResult>(
    initialResult ?? { status: "idle", message: "", checkedAt: null }
  );

  useEffect(() => {
    if (initialResult != null && (initialResult.status !== "idle" || initialResult.checkedAt || initialResult.message)) {
      setResult(initialResult);
    }
  }, [initialResult?.status, initialResult?.checkedAt, initialResult?.message]);

  const handleTest = async () => {
    const value = getValue();
    if (!value.trim()) {
      const emptyHints: Record<string, string> = {
        ai: "尚未輸入 API Key，請先輸入 AI 模型的 API 金鑰",
        fb: "尚未輸入 Access Token，請先輸入 Facebook API 存取權杖",
        ga4: "尚未輸入 Property ID，請先輸入 GA4 資源 ID",
      };
      setResult({
        status: "error",
        message: emptyHints[type] || "欄位不能為空",
        checkedAt: new Date().toISOString(),
      });
      toast({
        title: "無法驗證",
        description: emptyHints[type] || "請先輸入對應欄位值",
        variant: "destructive",
      });
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
        errorCode: data.errorCode,
        statusCode: data.statusCode,
        providerErrorMessage: data.providerErrorMessage,
      });
      if (data.success) {
        toast({ title: "連線成功", description: data.message });
      } else {
        toast({ title: "驗證失敗", description: data.message, variant: "destructive" });
      }
    } catch (err: unknown) {
      const checkedAt = new Date().toISOString();
      const errMsg = err instanceof Error ? err.message : String(err);
      let payload: Partial<ConnectionResult> = {
        status: "error",
        message: "網路錯誤或伺服器無回應，請檢查連線狀態",
        checkedAt,
      };
      const match = errMsg.match(/^\d+:\s*(\{[\s\S]*\})$/);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          payload = {
            status: "error",
            message: data.message || payload.message,
            checkedAt: data.checkedAt || checkedAt,
            testedModel: data.testedModel,
            errorCode: data.errorCode,
            statusCode: data.statusCode,
            providerErrorMessage: data.providerErrorMessage,
          };
        } catch {
          payload.message = errMsg.slice(0, 300) || payload.message;
        }
      } else if (errMsg && errMsg.length < 500) {
        payload.message = errMsg;
      }
      setResult((prev) => ({ ...prev, ...payload }));
      toast({ title: "連線失敗", description: payload.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2" data-testid={`connection-section-${type}`}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={result.status === "testing"}
          className="gap-1.5 shrink-0"
          data-testid={`button-test-${type}`}
        >
          {result.status === "testing" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plug className="w-3.5 h-3.5" />
          )}
          {result.status === "testing" ? "驗證中..." : "測試連線"}
        </Button>
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusLamp status={result.status} />
          <span
            className={`text-xs truncate ${
              result.status === "success"
                ? "text-emerald-700"
                : result.status === "error"
                  ? "text-rose-600"
                  : result.status === "testing"
                    ? "text-amber-600"
                    : "text-muted-foreground"
            }`}
            data-testid={`status-text-${type}`}
          >
            {STATUS_LABELS[result.status]}
          </span>
          {result.checkedAt && result.status !== "testing" && (
            <span
              className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0"
              data-testid={`status-time-${type}`}
            >
              <Clock className="w-3 h-3" />
              {formatTimeAgo(result.checkedAt)}
            </span>
          )}
        </div>
      </div>
      {result.status === "error" && result.message && (
        <p className="text-xs text-rose-600 pl-0.5" data-testid={`error-message-${type}`}>
          {result.message}
        </p>
      )}
      {result.status === "error" &&
        (result.errorCode != null || result.statusCode != null || result.providerErrorMessage) && (
          <div
            className="text-[11px] text-muted-foreground pl-0.5 space-y-0.5 border-l-2 border-muted pl-2"
            data-testid={`error-diagnostics-${type}`}
          >
            {result.errorCode != null && (
              <div>
                <span className="font-medium">errorCode:</span> {result.errorCode}
              </div>
            )}
            {result.statusCode != null && (
              <div>
                <span className="font-medium">statusCode:</span> {result.statusCode}
              </div>
            )}
            {result.providerErrorMessage != null && result.providerErrorMessage !== result.message && (
              <div>
                <span className="font-medium">providerErrorMessage:</span>{" "}
                <span className="break-all">{result.providerErrorMessage}</span>
              </div>
            )}
          </div>
        )}
      {showModel && result.testedModel && (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground pl-0.5" data-testid={`tested-model-${type}`}>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3" />
            <span>
              快速驗證模型: <span className="font-semibold text-foreground">{result.testedModel}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 pl-[18px]">
            <span>
              正式審判模型: <span className="font-semibold text-foreground">{CURRENT_AI_MODEL}</span>
            </span>
          </div>
        </div>
      )}
      {type === "fb" && result.status === "success" && result.accountPreview && (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground pl-0.5" data-testid="fb-account-preview">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3" />
            <span>
              可用廣告帳號:{" "}
              <span className="font-semibold text-foreground">{result.accountPreview.totalCount} 個</span>
            </span>
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
        <div
          className="flex items-start gap-1.5 text-xs text-amber-800 border border-slate-200 bg-white border-l-4 border-l-amber-500 rounded-xl px-2.5 py-1.5 dark:border-border dark:bg-card dark:text-amber-200"
          data-testid="ga4-auth-hint"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>GA4 驗證需要 Service Account 憑證。請在環境變數中設定 GOOGLE_SERVICE_ACCOUNT_KEY。</span>
        </div>
      )}
      {result.status === "success" && result.message && (
        <div
          className="flex items-start gap-1.5 text-xs text-emerald-800 border border-slate-200 bg-white border-l-4 border-l-emerald-500 rounded-xl px-2.5 py-1.5 dark:border-border dark:bg-card dark:text-emerald-200"
          data-testid={`status-detail-${type}`}
        >
          <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{result.message}</span>
        </div>
      )}
      {result.status === "error" && result.message && (
        <div
          className="flex items-start gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1.5 dark:border-rose-800/50"
          data-testid={`status-error-${type}`}
        >
          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
