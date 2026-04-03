import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CoverageCheckData } from "../team-types";

export function TeamCoverageCards({
  coverageData,
  employees,
}: {
  coverageData: CoverageCheckData | undefined;
  employees: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Card className={coverageData?.missingPrimary?.length ? "border-amber-200 dark:border-amber-800" : ""}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">缺 primary owner 的在投商品</CardTitle>
          <p className="text-2xl font-semibold text-muted-foreground">{(coverageData?.missingPrimary?.length) ?? 0}</p>
        </CardHeader>
        <CardContent className="py-0 px-4 pb-3">
          <ul className="text-xs text-muted-foreground space-y-0.5 mb-2">
            {(coverageData?.missingPrimary ?? []).slice(0, 3).map((p) => (
              <li key={p} className="truncate">{p}</li>
            ))}
            {(coverageData?.missingPrimary?.length ?? 0) > 3 && (
              <li>…共 {(coverageData?.missingPrimary?.length) ?? 0} 筆</li>
            )}
          </ul>
          <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" })}>
            立即處理
          </Button>
        </CardContent>
      </Card>
      <Card className={coverageData?.missingBackup?.length ? "border-amber-200 dark:border-amber-800" : ""}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">缺 backup owner 的在投商品</CardTitle>
          <p className="text-2xl font-semibold text-muted-foreground">{(coverageData?.missingBackup?.length) ?? 0}</p>
        </CardHeader>
        <CardContent className="py-0 px-4 pb-3">
          <ul className="text-xs text-muted-foreground space-y-0.5 mb-2">
            {(coverageData?.missingBackup ?? []).slice(0, 3).map((p) => (
              <li key={p} className="truncate">{p}</li>
            ))}
            {(coverageData?.missingBackup?.length ?? 0) > 3 && (
              <li>…共 {(coverageData?.missingBackup?.length) ?? 0} 筆</li>
            )}
          </ul>
          <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" })}>
            立即處理
          </Button>
        </CardContent>
      </Card>
      <Card className={coverageData?.overload?.length ? "border-amber-200 dark:border-amber-800" : ""}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">主責超載的人</CardTitle>
          <p className="text-2xl font-semibold text-muted-foreground">{(coverageData?.overload?.length) ?? 0}</p>
        </CardHeader>
        <CardContent className="py-0 px-4 pb-3">
          <ul className="text-xs text-muted-foreground space-y-0.5 mb-2">
            {(coverageData?.overload ?? []).slice(0, 3).map((o) => {
              const name = employees.find((e) => e.id === o.userId)?.name || o.userId;
              return (
                <li key={o.userId}>{name}（primary × {o.asPrimaryCount}）</li>
              );
            })}
            {(coverageData?.overload?.length ?? 0) > 3 && (
              <li>…共 {(coverageData?.overload?.length) ?? 0} 筆</li>
            )}
          </ul>
          <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" })}>
            立即處理
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
