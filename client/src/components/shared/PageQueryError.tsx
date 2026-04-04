import { Button } from "@/components/ui/button";

export function PageQueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-6 text-center"
      data-testid="page-query-error"
    >
      <p className="text-sm text-destructive font-medium">資料載入失敗</p>
      <p className="text-xs text-muted-foreground mt-1">{message}</p>
      <Button variant="outline" size="sm" className="mt-3" type="button" onClick={() => onRetry()}>
        重試
      </Button>
    </div>
  );
}
