import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "../products-formatters";

export function ProductsOverviewBoard(props: {
  count: number;
  totalSpend: number;
  totalRevenue: number;
  avgRoas: number;
}) {
  const { count, totalSpend, totalRevenue, avgRoas } = props;
  return (
    <Card className="border-slate-200 bg-white dark:border-border dark:bg-card">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <span>
            商品數 <strong>{count}</strong>
          </span>
          <span>
            總花費 <strong>{formatCurrency(totalSpend)}</strong>
          </span>
          <span>
            總營收 <strong>{formatCurrency(totalRevenue)}</strong>
          </span>
          <span>
            平均 ROAS <strong>{avgRoas.toFixed(2)}</strong>
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          每張卡整理：值不值得加碼、原因、強弱素材、下一步，以及保本／目標 ROAS 與利潤空間。
        </p>
      </CardContent>
    </Card>
  );
}
