import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { ActionCenterData } from "@/pages/dashboard/dashboard-types";

export function SettingsMyProductScopeCard() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: actionData, isLoading } = useQuery<ActionCenterData>({
    queryKey: ["/api/dashboard/action-center", "settings-product-picker"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/action-center", { credentials: "include" });
      if (!res.ok) return { productLevel: [], creativeLeaderboard: [], hiddenGems: [], urgentStop: [], riskyCampaigns: [] };
      return res.json();
    },
  });

  const productOptions = useMemo(() => {
    const main = actionData?.productLevelMain ?? actionData?.productLevel ?? [];
    const names = new Set<string>();
    for (const p of main) {
      const n = (p as { productName?: string }).productName;
      if (n && n !== "未分類") names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }, [actionData]);

  useEffect(() => {
    const scope = user?.defaultProductScope;
    if (scope && scope.length > 0) {
      setSelected(new Set(scope));
    } else {
      setSelected(new Set());
    }
  }, [user?.defaultProductScope]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body =
        selected.size === 0
          ? { defaultProductScope: null as string[] | null }
          : { defaultProductScope: [...selected] };
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "儲存失敗");
      }
      await refreshUser();
      toast({ title: "已儲存「我的負責商品」", duration: 2500 });
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "儲存失敗",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6" data-testid="card-settings-my-product-scope">
      <CardHeader>
        <CardTitle className="text-base">我的負責商品（看板範圍）</CardTitle>
        <p className="text-xs text-muted-foreground">
          勾選後，首頁與商品／預算相關頁在「我的商品」模式下只顯示這些商品。未勾選任何項並儲存則不限制（等同先看全部，再到頁面切「全部」）。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            載入商品清單…
          </p>
        ) : productOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚無批次商品資料，請先同步並更新資料後再設定。</p>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-2 border rounded-md p-3">
            {productOptions.map((name) => (
              <div key={name} className="flex items-center gap-2">
                <Checkbox
                  id={`scope-${name}`}
                  checked={selected.has(name)}
                  onCheckedChange={() => toggle(name)}
                />
                <Label htmlFor={`scope-${name}`} className="text-sm font-normal cursor-pointer">
                  {name}
                </Label>
              </div>
            ))}
          </div>
        )}
        <Button type="button" onClick={() => void handleSave()} disabled={saving || isLoading}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          儲存看板商品範圍
        </Button>
      </CardContent>
    </Card>
  );
}
