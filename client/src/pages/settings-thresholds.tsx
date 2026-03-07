/**
 * 門檻設定：經營語言、百分比顯示、已發布 vs 草稿差異、preset、推薦說明
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sliders, Upload, RotateCcw, AlertTriangle, Info } from "lucide-react";

const DEFAULT: Record<string, number> = {
  spendThresholdStop: 1500,
  roasTargetMin: 1.0,
  roasScaleMin: 2.5,
  ctrHigh: 2.5,
  frequencyFatigue: 8,
  minSpendForRules: 300,
  minClicks: 50,
  minATC: 3,
  minPurchases: 2,
  minSpend: 300,
  funnelAtcTolerance: 0.2,
  funnelPurchaseTolerance: 0.2,
  luckySpendThreshold: 500,
  luckyMinPurchasesToExclude: 2,
};

/** 0.x 容差欄位：UI 顯示與輸入用百分比 */
const PERCENT_KEYS = ["funnelAtcTolerance", "funnelPurchaseTolerance"] as const;
const CTR_KEY = "ctrHigh"; // 已是 % 數值，顯示時加 %

function toPercentDisplay(val: number): string {
  return `${Math.round(val * 100)}%`;
}
function fromPercentInput(s: string): number {
  const n = parseFloat(s.replace(/%/g, "").trim());
  return Number.isFinite(n) ? n / 100 : 0;
}
function toPercentInput(val: number): string {
  return String(Math.round(val * 100));
}

type FieldDef = { key: string; label: string; description: string; isPercent?: boolean; isRatio?: boolean };

const FIELDS: FieldDef[] = [
  { key: "spendThresholdStop", label: "停損花費門檻", description: "單一廣告達此花費且未達 ROAS 目標時，建議停損。" },
  { key: "roasTargetMin", label: "ROAS 目標下限", description: "判定「達標」的最低 ROAS，低於此視為未達標。" },
  { key: "roasScaleMin", label: "加碼 ROAS 門檻", description: "達此 ROAS 以上才建議加碼預算。" },
  { key: "ctrHigh", label: "CTR 高標", description: "用於判斷素材點擊表現是否優秀。", isRatio: true },
  { key: "frequencyFatigue", label: "疲勞頻率", description: "曝光頻率超過此值視為疲勞，建議輪替素材。" },
  { key: "minSpendForRules", label: "規則最低花費", description: "達此花費才套用決策規則，避免小預算被誤判。" },
  { key: "minClicks", label: "最低點擊門檻", description: "進入 ROI 漏斗計算的最低點擊數。" },
  { key: "minATC", label: "最低加購數門檻", description: "進入 ROI 漏斗計算的最低加購數。" },
  { key: "minPurchases", label: "最低購買數門檻", description: "進入 ROI 漏斗計算的最低購買數。" },
  { key: "minSpend", label: "ROI 漏斗最低花費", description: "進入 ROI 漏斗計算的最低花費；過低易造成 Lucky 誤判。" },
  { key: "funnelAtcTolerance", label: "加購率容許偏差", description: "加購率與基準的容差，超過視為漏斗異常。", isPercent: true },
  { key: "funnelPurchaseTolerance", label: "購買率容許偏差", description: "購買轉換率與基準的容差。", isPercent: true },
  { key: "luckySpendThreshold", label: "低花費運氣單判定上限", description: "花費低於此且轉換好，可能標為 Lucky（需補量驗證）。" },
  { key: "luckyMinPurchasesToExclude", label: "Lucky 排除最少購買數", description: "購買數達此以上較不視為純運氣，可排除 Lucky。" },
];

const PRESETS: { id: string; label: string; description: string; config: Record<string, number> }[] = [
  {
    id: "conservative",
    label: "保守測試",
    description: "門檻較嚴，適合小預算或測試期，減少誤判。",
    config: {
      ...DEFAULT,
      spendThresholdStop: 1000,
      roasTargetMin: 1.5,
      roasScaleMin: 3,
      minClicks: 80,
      minATC: 5,
      minPurchases: 3,
      minSpend: 400,
      funnelAtcTolerance: 0.15,
      funnelPurchaseTolerance: 0.15,
      luckySpendThreshold: 400,
    },
  },
  {
    id: "standard",
    label: "標準測試",
    description: "平衡門檻，適合多數投放情境。",
    config: { ...DEFAULT },
  },
  {
    id: "aggressive",
    label: "積極擴量",
    description: "門檻較鬆，適合已有穩定轉換、要放量時。",
    config: {
      ...DEFAULT,
      spendThresholdStop: 2500,
      roasTargetMin: 0.8,
      roasScaleMin: 2,
      minClicks: 30,
      minATC: 2,
      minPurchases: 1,
      minSpend: 200,
      funnelAtcTolerance: 0.25,
      funnelPurchaseTolerance: 0.25,
      luckySpendThreshold: 600,
    },
  },
];

function formatDisplayValue(key: string, val: number, def: FieldDef): string {
  if (def.isPercent) return toPercentDisplay(val);
  if (def.isRatio || key === "ctrHigh") return `${val}%`;
  return String(val);
}

export default function SettingsThresholdsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(DEFAULT);

  const { data: published = {} } = useQuery({
    queryKey: ["/api/workbench/thresholds/published"],
    queryFn: async () => {
      const res = await fetch("/api/workbench/thresholds/published", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
  });

  useQuery({
    queryKey: ["/api/workbench/thresholds/draft"],
    queryFn: async () => {
      const res = await fetch("/api/workbench/thresholds/draft", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    onSuccess: (data: Record<string, number> | null) => {
      if (data && typeof data === "object") setDraft({ ...DEFAULT, ...data });
    },
  });

  const saveDraft = useMutation({
    mutationFn: async (config: Record<string, number>) => {
      const res = await fetch("/api/workbench/thresholds/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        credentials: "include",
      });
      if (!res.ok) throw new Error("儲存失敗");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workbench/thresholds/draft"] }),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/workbench/thresholds/publish", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("發布失敗");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workbench/thresholds/published", "/api/workbench/decision-cards"] }),
  });

  const rollback = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/workbench/thresholds/rollback", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("回滾失敗");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workbench/thresholds/published", "/api/workbench/decision-cards"] }),
  });

  const current = Object.keys(published).length > 0 ? (published as Record<string, number>) : DEFAULT;
  const hasDraftDiff = FIELDS.some((f) => (draft[f.key] ?? DEFAULT[f.key]) !== (current[f.key] ?? DEFAULT[f.key]));

  const extremeWarnings: string[] = [];
  const stopVal = current.spendThresholdStop ?? DEFAULT.spendThresholdStop;
  if (stopVal >= 9999) extremeWarnings.push("停損花費門檻設為 9999 以上，等於幾乎不自動建議停損，請確認是否為刻意設定。");
  if ((current.minSpend ?? DEFAULT.minSpend) < 200) extremeWarnings.push("ROI 漏斗最低花費過低（<200）易造成 Lucky 誤判，建議至少 200–300。");
  if ((current.minSpendForRules ?? DEFAULT.minSpendForRules) < 200) extremeWarnings.push("規則最低花費過低，小預算廣告可能被規則誤觸。");

  const applyPreset = (config: Record<string, number>) => setDraft({ ...DEFAULT, ...config });

  return (
    <div className="flex flex-col min-h-full bg-background">
      <header className="flex flex-wrap items-center gap-3 p-4 border-b shrink-0">
        <SidebarTrigger />
        <h1 className="page-title flex items-center gap-2">
          <Sliders className="w-5 h-5" />
          門檻設定
        </h1>
      </header>
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              影響頁面
            </CardTitle>
            <p className="text-sm text-muted-foreground">以下頁面會依「已發布」門檻計算結果。修改草稿後按「發布」即生效。</p>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc pl-4 space-y-1">
              <li>素材生命週期（ROI 漏斗、Lucky／Winner 等標籤）</li>
              <li>成功率成績單（達標與淘汰判定）</li>
              <li>汰換建議與決策卡</li>
              <li>RICH BEAR 審判官決策卡（規則引擎產出）</li>
            </ul>
          </CardContent>
        </Card>

        {/* 已發布 vs 草稿差異 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">已發布 vs 草稿</CardTitle>
            <p className="text-sm text-muted-foreground">
              {hasDraftDiff ? "草稿與目前已發布值不同，儲存草稿後按「發布」可更新決策卡。" : "草稿與已發布一致。"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">項目</th>
                    <th className="text-left p-2 font-medium">已發布（使用中）</th>
                    <th className="text-left p-2 font-medium">草稿</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((f) => {
                    const pubVal = current[f.key] ?? DEFAULT[f.key];
                    const draftVal = draft[f.key] ?? DEFAULT[f.key];
                    const diff = pubVal !== draftVal;
                    return (
                      <tr key={f.key} className={diff ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                        <td className="p-2">{f.label}</td>
                        <td className="p-2 text-muted-foreground">{formatDisplayValue(f.key, pubVal, f)}</td>
                        <td className="p-2 font-medium">{formatDisplayValue(f.key, draftVal, f)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-3 gap-1" onClick={() => rollback.mutate()} disabled={rollback.isPending}>
              <RotateCcw className="w-3 h-3" /> 回滾至上版
            </Button>
          </CardContent>
        </Card>

        {extremeWarnings.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                高風險提示
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                {extremeWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 快速套用 preset */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快速套用</CardTitle>
            <p className="text-sm text-muted-foreground">一鍵套用後可再微調，記得儲存草稿並發布。</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {PRESETS.map((p) => (
              <div key={p.id} className="rounded-lg border p-4 min-w-[200px]">
                <p className="font-medium text-sm">{p.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => applyPreset(p.config)}>
                  套用
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 目前推薦設定說明 */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">目前推薦設定說明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              若你選擇的是<strong>保守測試</strong>：適合剛開始投放或預算較小，門檻較嚴可減少「誤判停損」或「誤判 Lucky」。
            </p>
            <p>
              若你選擇的是<strong>標準測試</strong>：適合多數情境，平衡敏感度與覆蓋率。
            </p>
            <p>
              若你選擇的是<strong>積極擴量</strong>：適合已有穩定轉換、要放量時，門檻較鬆可讓更多素材進入加碼建議。
            </p>
          </CardContent>
        </Card>

        {/* 草稿編輯 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">編輯草稿</CardTitle>
            <p className="text-sm text-muted-foreground">所有 0.x 類數值在此以百分比顯示與輸入（例如 20 表示 20%）。</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {FIELDS.map((f) => {
              const isPercent = f.isPercent ?? PERCENT_KEYS.includes(f.key as any);
              const isCtr = f.key === CTR_KEY;
              const rawVal = draft[f.key] ?? DEFAULT[f.key];
              const displayVal = isPercent ? toPercentInput(rawVal) : isCtr ? String(rawVal) : String(rawVal);
              return (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="w-44 font-medium">{f.label}</Label>
                    {isPercent ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={displayVal}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: fromPercentInput(e.target.value) }))}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    ) : isCtr ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step={0.1}
                          value={displayVal}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: Number(e.target.value) || 0 }))}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        step={f.key.includes("Tolerance") ? 0.01 : 1}
                        value={displayVal}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: Number(e.target.value) ?? 0 }))}
                        className="w-32"
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground pl-0">{f.description}</p>
                </div>
              );
            })}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => saveDraft.mutate(draft)} disabled={saveDraft.isPending}>
                儲存草稿
              </Button>
              <Button size="sm" variant="default" className="gap-1" onClick={() => publish.mutate()} disabled={publish.isPending}>
                <Upload className="w-3 h-3" /> 發布（立即影響決策卡）
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
