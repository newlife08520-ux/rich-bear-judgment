/**
 * 將政策條、範圍不一致、partial_data、批次有效性、覆蓋度等「狀態層」收合在戰略區之後，避免搶首屏。
 * 內容不可刪除，僅調整層級與預設摺疊。
 */
import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, ChevronDown } from "lucide-react";
export function StrategicDiagnosticsCollapsible({
  defaultOpen = false,
  children,
  triggerHint,
}: {
  defaultOpen?: boolean;
  children: ReactNode;
  /** 例如「2 項需注意」 */
  triggerHint?: string;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="group border border-border/60 rounded-lg bg-muted/10"
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-between rounded-lg px-4 py-3 h-auto text-sm font-medium text-muted-foreground hover:text-foreground"
          data-testid="button-strategic-diagnostics-toggle"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            資料狀態
            {triggerHint ? (
              <span className="text-xs font-normal text-amber-700 dark:text-amber-300">· {triggerHint}</span>
            ) : null}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="border-0 shadow-none rounded-t-none">
          <CardContent className="pt-0 pb-4 px-4 space-y-3">{children}</CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
