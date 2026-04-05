import { Scale, CheckCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function DashboardWelcomeEmpty({
  hasGeminiKey,
  hasMetaToken,
  hasBatchData,
}: {
  hasGeminiKey: boolean;
  hasMetaToken: boolean;
  hasBatchData: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 gap-4 px-4"
      data-testid="dashboard-welcome-empty"
    >
      <Scale className="w-12 h-12 text-indigo-600/70 dark:text-indigo-400/70" />
      <h2 className="text-xl font-bold text-center">歡迎使用華麗熊審判官</h2>
      <p className="text-muted-foreground text-center max-w-md text-sm">
        還沒有資料可以分析。請先完成以下設定：
      </p>
      <div className="space-y-2 text-sm w-full max-w-md">
        <div className="flex items-center gap-2">
          {hasGeminiKey ? (
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span>設定 Gemini API Key</span>
        </div>
        <div className="flex items-center gap-2">
          {hasMetaToken ? (
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span>連結 Meta 廣告帳戶</span>
        </div>
        <div className="flex items-center gap-2">
          {hasBatchData ? (
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span>同步並更新資料</span>
        </div>
      </div>
      <Button asChild>
        <Link href="/settings">前往設定</Link>
      </Button>
    </div>
  );
}
