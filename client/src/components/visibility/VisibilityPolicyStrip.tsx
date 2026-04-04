import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import type { DormantGemCandidateItem } from "@/pages/dashboard/dashboard-types";

export function VisibilityPolicyStrip({
  dormantGemCandidates = [],
  noDeliveryCount = 0,
  underSampleCount = 0,
  visibilityPolicyVersion,
  surface,
}: {
  dormantGemCandidates?: DormantGemCandidateItem[];
  noDeliveryCount?: number;
  underSampleCount?: number;
  visibilityPolicyVersion?: string;
  surface: "dashboard" | "fb-ads" | "creative-intelligence" | "products";
}) {
  const dormantN = dormantGemCandidates.length;
  if (dormantN === 0 && noDeliveryCount === 0 && underSampleCount === 0) return null;

  return (
    <Card
      className="border-violet-200 dark:border-violet-900/50 bg-violet-50/35 dark:bg-violet-950/20"
      data-testid={`visibility-policy-strip-${surface}`}
    >
      <CardContent className="py-3 px-4 text-sm space-y-1">
        <p className="font-medium text-violet-900 dark:text-violet-100">
          可見性政策（零花費分層）
          {visibilityPolicyVersion ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">版本 {visibilityPolicyVersion}</span>
          ) : null}
        </p>
        {dormantN > 0 && (
          <p className="text-muted-foreground">
            沉睡贏家／休眠高潛 <strong className="text-foreground">{dormantN}</strong> 筆（主視窗零花費、近期曾有花費＋品質訊號）— 不與「尚未投遞」混列。
          </p>
        )}
        {(noDeliveryCount > 0 || underSampleCount > 0) && (
          <p className="text-muted-foreground">
            診斷：未投遞 {noDeliveryCount}、樣本不足 {underSampleCount}（不進主決策加碼／止血表）。
          </p>
        )}
        <p className="text-xs text-muted-foreground pt-1">
          {surface === "dashboard" ? (
            "與本頁五大決策區、資料健康區使用同一資料來源。"
          ) : (
            <>
              首頁「資料健康」與{" "}
              <Link href="/" className="text-primary hover:underline">
                今日決策中心
              </Link>{" "}
              使用相同彙總邏輯。
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
