import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <div className="p-8 md:p-12 max-w-md mx-auto space-y-4" data-testid="page-access-denied">
      <h1 className="text-lg font-semibold">無權限瀏覽此頁</h1>
      <p className="text-sm text-muted-foreground">
        此區塊僅供特定角色使用。請改從側欄進入您可使用的頁面，或聯絡管理員調整權限。
      </p>
      <Button asChild variant="default" size="sm">
        <Link href="/">返回今日決策中心</Link>
      </Button>
    </div>
  );
}
