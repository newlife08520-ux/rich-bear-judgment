/**
 * 獲利規則中心：每個商品的成本比、目標淨利率、樣本門檻
 * 自動計算保本 ROAS、目標 ROAS
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ProductProfitRule = {
  costRatio: number;
  targetNetMargin: number;
  minSpend: number;
  minClicks: number;
  minATC: number;
  minPurchases: number;
};

function breakEvenRoas(costRatio: number): number {
  if (costRatio >= 1) return Infinity;
  return 1 / (1 - costRatio);
}
function targetRoas(costRatio: number, targetNetMargin: number): number {
  const m = 1 - costRatio - targetNetMargin;
  if (m <= 0) return Infinity;
  return 1 / m;
}

const DEFAULT_RULE: ProductProfitRule = {
  costRatio: 0.4,
  targetNetMargin: 0.15,
  minSpend: 100,
  minClicks: 30,
  minATC: 3,
  minPurchases: 1,
};

export default function SettingsProfitRulesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newProduct, setNewProduct] = useState("");

  const { data: productNames = [] } = useQuery<string[]>({
    queryKey: ["/api/dashboard/product-names"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/product-names", { credentials: "include" });
      if (!res.ok) return [];
      const j = await res.json();
      return j.productNames ?? [];
    },
  });

  const { data: rules = {} } = useQuery<Record<string, ProductProfitRule>>({
    queryKey: ["/api/profit-rules"],
    queryFn: async () => {
      const res = await fetch("/api/profit-rules", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { productName: string; rule: Partial<ProductProfitRule> }) => {
      await apiRequest("PUT", "/api/profit-rules", { productName: payload.productName, ...payload.rule });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profit-rules"] });
      toast({ title: "已儲存獲利規則" });
    },
    onError: (e: Error) => toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  });

  const products = Array.from(new Set([...productNames, ...Object.keys(rules), newProduct].filter(Boolean))).sort();

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center gap-3 p-4 border-b shrink-0">
        <SidebarTrigger />
        <h1 className="page-title flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          獲利規則中心
        </h1>
      </header>
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">公式</p>
            <ul className="space-y-0.5 text-xs">
              <li><strong>保本 ROAS</strong> = 1 / (1 - 成本比)</li>
              <li><strong>目標 ROAS</strong> = 1 / (1 - 成本比 - 目標淨利率)</li>
              <li>樣本門檻：最小花費、點擊、ATC、Purchase 未達則視為樣本不足，不建議重手調整。</li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex gap-2 items-end">
          <div className="flex-1 max-w-xs">
            <Label>新增商品（名稱）</Label>
            <Input
              value={newProduct}
              onChange={(e) => setNewProduct(e.target.value)}
              placeholder="輸入商品名稱後會出現在下方"
            />
          </div>
        </div>

        <div className="space-y-6">
          {products.map((productName) => {
            const r = rules[productName] ?? DEFAULT_RULE;
            const be = breakEvenRoas(r.costRatio);
            const target = targetRoas(r.costRatio, r.targetNetMargin);
            return (
              <Card key={productName}>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-base">{productName}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <Label className="text-xs">成本比 (0~1)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={r.costRatio}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isFinite(v)) return;
                        saveMutation.mutate({ productName, rule: { ...r, costRatio: v } });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">目標淨利率 (0~1)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={r.targetNetMargin}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isFinite(v)) return;
                        saveMutation.mutate({ productName, rule: { ...r, targetNetMargin: v } });
                      }}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-4 text-muted-foreground">
                    <span>保本 ROAS = <strong className="text-foreground">{be < 1e6 ? be.toFixed(2) : "—"}</strong></span>
                    <span>目標 ROAS = <strong className="text-foreground">{target < 1e6 ? target.toFixed(2) : "—"}</strong></span>
                  </div>
                  <div>
                    <Label className="text-xs">最小花費</Label>
                    <Input
                      type="number"
                      min="0"
                      value={r.minSpend}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isFinite(v)) return;
                        saveMutation.mutate({ productName, rule: { ...r, minSpend: v } });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">最小點擊</Label>
                    <Input
                      type="number"
                      min="0"
                      value={r.minClicks}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isFinite(v)) return;
                        saveMutation.mutate({ productName, rule: { ...r, minClicks: v } });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">最小 ATC</Label>
                    <Input
                      type="number"
                      min="0"
                      value={r.minATC}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isFinite(v)) return;
                        saveMutation.mutate({ productName, rule: { ...r, minATC: v } });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">最小 Purchase</Label>
                    <Input
                      type="number"
                      min="0"
                      value={r.minPurchases}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isFinite(v)) return;
                        saveMutation.mutate({ productName, rule: { ...r, minPurchases: v } });
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
