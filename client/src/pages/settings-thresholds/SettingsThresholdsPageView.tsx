import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sliders, Upload, RotateCcw, AlertTriangle, Info } from "lucide-react";
import {
  CTR_KEY,
  DEFAULT,
  FIELDS,
  PERCENT_KEYS,
  PRESETS,
  formatDisplayValue,
  fromPercentInput,
  toPercentInput,
} from "./settings-thresholds-constants";
import type { SettingsThresholdsWorkbench } from "./useSettingsThresholdsWorkbench";

export function SettingsThresholdsPageView({ wb }: { wb: SettingsThresholdsWorkbench }) {
  const {
    draft,
    setDraft,
    published: current,
    hasDraftDiff,
    extremeWarnings,
    saveDraft,
    publish,
    rollback,
    applyPreset,
  } = wb;

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
              <li>審判官決策卡（規則引擎產出）</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">已發布 vs 草稿</CardTitle>
            <p className="text-sm text-muted-foreground">
              {hasDraftDiff
                ? "草稿與目前已發布值不同，儲存草稿後按「發布」可更新決策卡。"
                : "草稿與已發布一致。"}
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
                      <tr key={f.key} className={diff ? "bg-slate-50 border-l-4 border-l-amber-500 dark:bg-muted/30" : ""}>
                        <td className="p-2">{f.label}</td>
                        <td className="p-2 text-muted-foreground">{formatDisplayValue(f.key, pubVal, f)}</td>
                        <td className="p-2 font-medium">{formatDisplayValue(f.key, draftVal, f)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 gap-1"
              onClick={() => rollback.mutate()}
              disabled={rollback.isPending}
            >
              <RotateCcw className="w-3 h-3" /> 回滾至上版
            </Button>
          </CardContent>
        </Card>

        {extremeWarnings.length > 0 && (
          <Card className="border-slate-200 bg-white border-l-4 border-l-amber-500 dark:border-border dark:bg-card">
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

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">目前推薦設定說明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              若你選擇的是<strong>保守測試</strong>：適合剛開始投放或預算較小，門檻較嚴可減少「誤判停損」或「誤判
              Lucky」。
            </p>
            <p>
              若你選擇的是<strong>標準測試</strong>：適合多數情境，平衡敏感度與覆蓋率。
            </p>
            <p>
              若你選擇的是<strong>積極擴量</strong>：適合已有穩定轉換、要放量時，門檻較鬆可讓更多素材進入加碼建議。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">編輯草稿</CardTitle>
            <p className="text-sm text-muted-foreground">所有 0.x 類數值在此以百分比顯示與輸入（例如 20 表示 20%）。</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {FIELDS.map((f) => {
              const isPercent = f.isPercent ?? PERCENT_KEYS.includes(f.key as (typeof PERCENT_KEYS)[number]);
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
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, [f.key]: fromPercentInput(e.target.value) }))
                          }
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
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, [f.key]: Number(e.target.value) || 0 }))
                          }
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        step={f.key.includes("Tolerance") ? 0.01 : 1}
                        value={displayVal}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [f.key]: Number(e.target.value) ?? 0 }))
                        }
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
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                onClick={() => publish.mutate()}
                disabled={publish.isPending}
              >
                <Upload className="w-3 h-3" /> 發布（立即影響決策卡）
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
