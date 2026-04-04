import { Loader2 } from "lucide-react";

export function PageLoading() {
  return (
    <div className="flex items-center justify-center py-16 gap-2" data-testid="page-loading">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">載入中...</span>
    </div>
  );
}
