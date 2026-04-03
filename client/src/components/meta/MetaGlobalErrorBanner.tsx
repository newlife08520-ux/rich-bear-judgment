/**
 * 全域 Meta／外部 API 錯誤條（v2）：與 drift banner 分離；由各 surface 呼叫 reportMetaApiError 餵入。
 */
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useMetaApiError } from "@/context/meta-api-error-context";
import { X } from "lucide-react";

export function MetaGlobalErrorBanner() {
  const { lastError, clearMetaApiError, isStale } = useMetaApiError();
  if (!lastError || isStale) return null;

  const actionHint =
    lastError.primaryAction === "reauth"
      ? "請至設定重新授權或更新 Meta Token。"
      : lastError.primaryAction === "retry_later"
        ? "請稍後再試；若持續發生請檢查 Graph 狀態。"
        : lastError.primaryAction === "readonly"
          ? "目前建議以唯讀檢視為主，避免連續套用。"
          : lastError.primaryAction === "check_permissions"
            ? "請確認應用程式權限含 ads_read／ads_management 等必要範圍。"
            : "請依下方說明處理或聯絡管理員。";

  return (
    <Alert
      variant="destructive"
      className="rounded-none border-x-0 border-t-0 shrink-0"
      data-testid="meta-global-error-banner-v2"
    >
      <AlertTitle className="text-sm flex items-center justify-between gap-2 pr-8">
        <span>{lastError.title}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => clearMetaApiError()}
          aria-label="關閉提示"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="text-xs space-y-2">
        <p>{lastError.description}</p>
        {lastError.secondaryNote ? <p className="text-muted-foreground">{lastError.secondaryNote}</p> : null}
        <p className="font-medium">{actionHint}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/settings">開啟設定</Link>
          </Button>
          {(lastError.primaryAction === "reauth" || lastError.primaryAction === "check_permissions") && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/publish">投放中心</Link>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
