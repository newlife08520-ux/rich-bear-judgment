/**
 * P1-5 商品映射：未映射清單、手動覆蓋、衝突顯示
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { MapPin, AlertTriangle } from "lucide-react";

export default function ProductMappingPage() {
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});

  const { data: context = { unmapped: [], conflicts: [], productNames: [] } } = useQuery({
    queryKey: ["/api/workbench/mapping/context"],
    queryFn: async () => {
      const res = await fetch("/api/workbench/mapping/context", { credentials: "include" });
      if (!res.ok) return { unmapped: [], conflicts: [], productNames: [] };
      return res.json();
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async ({ campaignId, productName }: { campaignId: string; productName: string }) => {
      const res = await fetch("/api/workbench/mapping/override", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, productName }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("儲存失敗");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/mapping/context"] });
    },
  });

  const { unmapped, conflicts, productNames } = context;

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <h1 className="page-title flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            資料歸因修正
          </h1>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          此為資料修正工具，非日常主流程。未映射的廣告活動無法歸入商品維度時，請在此手動指定對應商品；同一素材若出現在多個商品下會列為衝突，需人工處理。
        </p>

        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              未映射清單（{unmapped.length}）
            </h2>
            {unmapped.length === 0 ? (
              <p className="text-sm text-muted-foreground">目前無未映射的廣告活動。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2">Campaign 名稱</th>
                      <th className="text-left p-2">指定商品</th>
                      <th className="text-left p-2">動作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmapped.map((u: { campaignId: string; campaignName: string }) => (
                      <tr key={u.campaignId} className="border-b">
                        <td className="p-2 font-medium">{u.campaignName}</td>
                        <td className="p-2">
                          <Select
                            value={selectedProducts[u.campaignId] || "_"}
                            onValueChange={(v) => setSelectedProducts((prev) => ({ ...prev, [u.campaignId]: v === "_" ? "" : v }))}
                          >
                            <SelectTrigger className="w-[160px] h-8">
                              <SelectValue placeholder="選擇商品" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_">— 不指定</SelectItem>
                              {productNames.map((p: string) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const p = selectedProducts[u.campaignId];
                              overrideMutation.mutate({ campaignId: u.campaignId, productName: p || "" });
                            }}
                          >
                            覆蓋儲存
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              映射衝突（同一素材對多商品）（{conflicts.length}）
            </h2>
            {conflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">目前無衝突。</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {conflicts.map((c: { creativeKey: string; products: string[] }, i: number) => (
                  <li key={i} className="flex items-center gap-2 rounded border p-2">
                    <span className="font-medium">{c.creativeKey}</span>
                    <span className="text-muted-foreground">→ 出現在商品：</span>
                    <span>{c.products.join("、")}</span>
                    <Link href="/products" className="ml-2 text-primary hover:underline text-xs">至商品中心處理</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
