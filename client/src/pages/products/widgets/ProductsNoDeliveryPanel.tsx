import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProductsUnmappedPanel } from "./ProductsUnmappedPanel";

export function ProductsNoDeliveryPanel({
  unmappedCount,
  productLevelNoDelivery,
  productLevelUnmapped,
}: {
  unmappedCount: number;
  productLevelNoDelivery: unknown[];
  productLevelUnmapped: Array<{ productName: string }>;
}) {
  if (unmappedCount <= 0 && productLevelNoDelivery.length === 0) return null;
  return (
    <Collapsible>
      <Card className="border-amber-200 dark:border-amber-800">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/30 rounded-t-lg"
          >
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              未投遞／未映射：{productLevelNoDelivery.length} 商品無花費 · {unmappedCount} 活動未映射
            </span>
            <ChevronRight className="w-4 h-4 shrink-0" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">建議修正活動命名或至「獲利規則中心」建立商品映射。</p>
            <ProductsUnmappedPanel productLevelUnmapped={productLevelUnmapped} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
