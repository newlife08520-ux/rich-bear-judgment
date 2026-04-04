import {
  ChevronDown,
  ChevronUp,
  Sliders,
  Target,
  BarChart3,
  Palette,
  Shield,
  Gauge,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { UseFormReturn } from "react-hook-form";
import type { SettingsInput } from "@shared/schema";
import { SettingsPillToggleGroup } from "./SettingsPillToggleGroup";

export function SettingsPreferencesCard({
  form,
  showAdvanced,
  setShowAdvanced,
  conservativeBudget,
  setConservativeBudget,
  lowConfidenceHint,
  setLowConfidenceHint,
}: {
  form: UseFormReturn<SettingsInput>;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  conservativeBudget: boolean;
  setConservativeBudget: (v: boolean) => void;
  lowConfidenceHint: boolean;
  setLowConfidenceHint: (v: boolean) => void;
}) {
  return (
    <Card className="mb-6" data-testid="section-preferences">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sliders className="w-4 h-4" />
          偏好設定
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">調整 AI 審判的方向、深度與語氣</p>
      </CardHeader>
      <CardContent className="space-y-5" data-testid="form-preferences">
        <SettingsPillToggleGroup
          label="目的"
          icon={Target}
          iconColor="text-emerald-500"
          description="AI 會根據目的調整分析重點"
          options={[
            { value: "conversion", label: "賣貨" },
            { value: "brand", label: "品牌" },
          ]}
          value={form.watch("analysisBias")}
          onChange={(v) => form.setValue("analysisBias", v as SettingsInput["analysisBias"], { shouldDirty: true })}
          testIdPrefix="bias"
        />
        <div className="border-t" />
        <SettingsPillToggleGroup
          label="深度"
          icon={BarChart3}
          iconColor="text-blue-500"
          description="決定報告的詳細程度"
          options={[
            { value: "summary", label: "快速" },
            { value: "standard", label: "標準" },
            { value: "detailed", label: "完整" },
          ]}
          value={form.watch("outputLength")}
          onChange={(v) => form.setValue("outputLength", v as SettingsInput["outputLength"], { shouldDirty: true })}
          testIdPrefix="depth"
        />
        <div className="border-t" />
        <SettingsPillToggleGroup
          label="語氣"
          icon={Palette}
          iconColor="text-violet-500"
          description="AI 說話的風格"
          options={[
            { value: "professional", label: "專業" },
            { value: "direct", label: "直接" },
            { value: "friendly", label: "親切" },
          ]}
          value={form.watch("brandTone")}
          onChange={(v) => form.setValue("brandTone", v as SettingsInput["brandTone"], { shouldDirty: true })}
          testIdPrefix="tone"
        />
        <div className="border-t" />
        <div data-testid="section-advanced-preferences">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between py-1 text-left cursor-pointer"
            data-testid="button-toggle-advanced-prefs"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sliders className="w-3.5 h-3.5" />
              進階調校
              <Badge variant="secondary" className="text-xs">
                選填
              </Badge>
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showAdvanced && (
            <div className="mt-4 space-y-5">
              <SettingsPillToggleGroup
                label="嚴格度"
                icon={Shield}
                iconColor="text-red-500"
                description="控制 AI 審判的標準高低"
                options={[
                  { value: "lenient", label: "寬鬆" },
                  { value: "moderate", label: "適中" },
                  { value: "strict", label: "嚴格" },
                ]}
                value={form.watch("severity")}
                onChange={(v) => form.setValue("severity", v as SettingsInput["severity"], { shouldDirty: true })}
                testIdPrefix="severity"
              />
              <div className="border-t" />
              <div className="space-y-2" data-testid="pills-confidence">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Gauge className="w-4 h-4 text-amber-500" />
                  Confidence 門檻
                </Label>
                <p className="text-xs text-muted-foreground">數據量不足時，AI 會自動降低信心分數</p>
                <div className="flex gap-2">
                  {[
                    { value: "low", label: "低（寬鬆）" },
                    { value: "medium", label: "中" },
                    { value: "high", label: "高（嚴謹）" },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={opt.value === "medium" ? "toggle-elevate toggle-elevated" : ""}
                      data-testid={`pill-confidence-${opt.value}`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="border-t" />
              <div className="space-y-4">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Info className="w-4 h-4 text-blue-500" />
                  其他偏好
                </Label>
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-3" data-testid="toggle-conservative-budget">
                    <div>
                      <p className="font-medium">保守預算建議</p>
                      <p className="text-xs text-muted-foreground">預算建議偏保守，加量前先觀察</p>
                    </div>
                    <Switch
                      checked={conservativeBudget}
                      onCheckedChange={setConservativeBudget}
                      data-testid="switch-conservative-budget"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3" data-testid="toggle-low-confidence-hint">
                    <div>
                      <p className="font-medium">低信心提示</p>
                      <p className="text-xs text-muted-foreground">數據不足時額外標記提醒</p>
                    </div>
                    <Switch
                      checked={lowConfidenceHint}
                      onCheckedChange={setLowConfidenceHint}
                      data-testid="switch-low-confidence-hint"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
