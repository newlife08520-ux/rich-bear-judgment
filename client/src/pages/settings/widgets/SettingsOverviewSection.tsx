import { Link } from "wouter";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, canAccess } from "@/lib/auth";

export function SettingsOverviewSection() {
  const { user } = useAuth();
  const r = user?.role;

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">管理工具</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">低頻設定與資料修正，非日常主流程</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {canAccess(r, "/mapping") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/mapping">資料歸因修正</Link>
            </Button>
          ) : null}
          {canAccess(r, "/settings/thresholds") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/thresholds">門檻設定</Link>
            </Button>
          ) : null}
          {canAccess(r, "/settings/profit-rules") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/profit-rules">獲利規則中心</Link>
            </Button>
          ) : null}
          {canAccess(r, "/settings/prompts") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/prompts">角色視角 Overlay</Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/team">團隊權限</Link>
          </Button>
          {canAccess(r, "/history") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/history">判讀紀錄</Link>
            </Button>
          ) : null}
          {canAccess(r, "/fb-ads") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/fb-ads">預算控制</Link>
            </Button>
          ) : null}
          {canAccess(r, "/ga4") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/ga4">漏斗 / 站內證據</Link>
            </Button>
          ) : null}
          {canAccess(r, "/execution-history") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/execution-history">全域執行稽核</Link>
            </Button>
          ) : null}
          {canAccess(r, "/scorecard") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/scorecard">成功率成績單</Link>
            </Button>
          ) : null}
          {canAccess(r, "/creative-lifecycle") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/creative-lifecycle">素材生命週期</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">AI 作戰設定</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">門檻與提示詞版本化、發布與回滾</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {canAccess(r, "/settings/thresholds") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/thresholds">門檻設定</Link>
            </Button>
          ) : null}
          {canAccess(r, "/settings/profit-rules") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/profit-rules">獲利規則中心</Link>
            </Button>
          ) : null}
          {canAccess(r, "/settings/prompts") ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/prompts">角色視角 Overlay</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            角色工作流
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">依角色建議每天看的 4 個核心頁面</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-semibold text-sm">老闆每天看</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  <Link href="/" className="text-primary hover:underline">
                    今日決策中心
                  </Link>
                </li>
                <li>
                  <Link href="/judgment" className="text-primary hover:underline">
                    審判官
                  </Link>
                </li>
                <li>
                  <Link href="/scorecard" className="text-primary hover:underline">
                    成功率成績單
                  </Link>
                </li>
                <li>
                  <Link href="/products" className="text-primary hover:underline">
                    商品中心
                  </Link>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-semibold text-sm">投手每天看</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  <Link href="/" className="text-primary hover:underline">
                    今日決策中心
                  </Link>
                </li>
                <li>
                  <Link href="/judgment" className="text-primary hover:underline">
                    審判官
                  </Link>
                </li>
                <li>
                  <Link href="/ga4" className="text-primary hover:underline">
                    漏斗 / 站內證據
                  </Link>
                </li>
                <li>
                  <Link href="/products" className="text-primary hover:underline">
                    商品中心
                  </Link>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-semibold text-sm">素材／企劃每天看</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  <Link href="/creative-lifecycle" className="text-primary hover:underline">
                    素材生命週期
                  </Link>
                </li>
                <li>
                  <Link href="/judgment" className="text-primary hover:underline">
                    審判官
                  </Link>
                </li>
                <li>
                  <Link href="/assets" className="text-primary hover:underline">
                    素材中心
                  </Link>
                </li>
                <li>
                  <Link href="/scorecard" className="text-primary hover:underline">
                    成功率成績單
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
