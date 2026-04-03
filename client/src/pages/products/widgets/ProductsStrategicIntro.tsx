import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

/** 商品中心頂部一句話：為何此表存在、與首頁戰略面分工。 */
export function ProductsStrategicIntro() {
  return (
    <Card className="border-primary/15 bg-primary/[0.03]" data-testid="products-strategic-intro">
      <CardContent className="py-3 px-4 flex gap-3 items-start">
        <Target className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-foreground/90 space-y-1">
          <p className="font-medium">此頁在做什麼</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            依負責人與篩選檢視<strong className="text-foreground">現役商品作戰卡</strong>；「沉睡／暫停高潛」與現役贏家<strong className="text-foreground">分桶列出</strong>，不與主網格混排。
            Pareto 與可見性政策提供脈絡，診斷（未投遞／未映射）置於底部，不干擾主排序。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
