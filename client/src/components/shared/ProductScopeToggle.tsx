import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProductViewScopeMode } from "@/hooks/use-product-view-scope";

export function ProductScopeToggle({
  mode,
  onModeChange,
  className,
}: {
  mode: ProductViewScopeMode;
  onModeChange: (m: ProductViewScopeMode) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-flex rounded-md border border-border bg-muted/30 p-0.5 gap-0.5", className)}
      role="group"
      aria-label="商品範圍"
    >
      <Button
        type="button"
        variant={mode === "mine" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 px-2.5 text-xs"
        onClick={() => onModeChange("mine")}
        data-testid="button-product-scope-mine"
      >
        我的商品
      </Button>
      <Button
        type="button"
        variant={mode === "all" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 px-2.5 text-xs"
        onClick={() => onModeChange("all")}
        data-testid="button-product-scope-all"
      >
        全部
      </Button>
    </div>
  );
}
