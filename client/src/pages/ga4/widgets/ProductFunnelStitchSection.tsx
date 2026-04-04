import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "../../fb-ads/widgets/shared";
import { formatPercent } from "../ga4-formatters";
import type { ProductFunnelRow } from "@shared/funnel-stitching";

const confidenceLabels: Record<ProductFunnelRow["stitchConfidence"], string> = {
  full: "完整縫合",
  fb_only: "僅 FB",
  ga4_only: "僅 GA4",
  no_match: "無對應",
};

function confidenceVariant(
  c: ProductFunnelRow["stitchConfidence"]
): "default" | "secondary" | "destructive" | "outline" {
  if (c === "full") return "secondary";
  if (c === "fb_only") return "outline";
  return "destructive";
}

export function ProductFunnelStitchSection(props: {
  rows: ProductFunnelRow[] | undefined;
  loading: boolean;
}) {
  const { rows, loading } = props;

  if (loading) {
    return (
      <Card data-testid="card-product-funnel-stitch-skeleton">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!rows || rows.length === 0) {
    return null;
  }

  const partial = rows.filter((r) => r.stitchConfidence !== "full");

  return (
    <div className="space-y-3" data-testid="section-product-funnel-stitch">
      {partial.length > 0 && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>漏斗縫合未完全</AlertTitle>
          <AlertDescription className="text-sm">
            共 {partial.length} 列非「完整縫合」（僅 FB、僅 GA4 或命名未對齊）。下列表格「縫合說明」可對照 UTM／商品命名。
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">商品漏斗縫合（FB × GA4）</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">商品</TableHead>
                <TableHead>縫合</TableHead>
                <TableHead className="min-w-[200px]">說明</TableHead>
                <TableHead>花費</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>工作階段</TableHead>
                <TableHead>加購率</TableHead>
                <TableHead>購買率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.productName} data-testid={`row-funnel-stitch-${r.productName}`}>
                  <TableCell className="font-medium text-sm">{r.productName}</TableCell>
                  <TableCell>
                    <Badge variant={confidenceVariant(r.stitchConfidence)} className="text-xs">
                      {confidenceLabels[r.stitchConfidence]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs">
                    {r.stitchNote ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{formatCurrency(r.spend)}</TableCell>
                  <TableCell className="text-sm tabular-nums">{r.ctr.toFixed(2)}%</TableCell>
                  <TableCell className="text-sm tabular-nums">{r.sessions}</TableCell>
                  <TableCell className="text-sm tabular-nums">{formatPercent(r.addToCartRate)}</TableCell>
                  <TableCell className="text-sm tabular-nums">{formatPercent(r.purchaseRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
