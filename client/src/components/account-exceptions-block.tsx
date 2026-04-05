/**
 * P3-1 帳號例外提醒：只顯示有異常的帳號，不回到帳號海。用於商品中心與 Judgment evidence。
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

type Anomaly = {
  accountId: string;
  accountName: string;
  title?: string;
  severity?: string;
  category?: string;
  description?: string;
};

type AccountException = {
  accountId: string;
  accountName: string;
  anomalyCount: number;
  anomalies: Anomaly[];
};

export function AccountExceptionsBlock({
  scopeAccountIds,
  scopeProducts,
  compact = false,
}: {
  scopeAccountIds?: string[];
  scopeProducts?: string[];
  compact?: boolean;
}) {
  const params = new URLSearchParams();
  if (scopeAccountIds?.length) params.set("scopeAccountIds", scopeAccountIds.join(","));

  const { data, isLoading } = useQuery<{ accounts: AccountException[] }>({
    queryKey: ["/api/dashboard/account-exceptions", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/account-exceptions?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return { accounts: [] };
      return res.json();
    },
  });

  const accounts = data?.accounts ?? [];
  if (isLoading || accounts.length === 0) return null;

  if (compact) {
    return (
      <Card className="border-slate-200 bg-white border-l-4 border-l-amber-500 dark:border-border dark:bg-card">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            帳號例外（{accounts.length} 個帳號有異常）
          </CardTitle>
        </CardHeader>
        <CardContent className="py-0 px-3 pb-2">
          <ul className="text-xs space-y-0.5">
            {accounts.slice(0, 5).map((a) => (
              <li key={a.accountId}>
                <span className="font-medium">{a.accountName || a.accountId}</span>
                <span className="text-muted-foreground"> · {a.anomalyCount} 筆異常</span>
              </li>
            ))}
            {accounts.length > 5 && (
              <li className="text-muted-foreground">…共 {accounts.length} 個帳號</li>
            )}
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 bg-white border-l-4 border-l-amber-500 dark:border-border dark:bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          帳號例外提醒
        </CardTitle>
        <p className="text-xs text-muted-foreground">僅顯示有異常的帳號，不回到帳號海</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.map((a) => (
          <div key={a.accountId} className="rounded-md border bg-background/80 p-2 text-sm">
            <div className="font-medium flex items-center gap-2">
              {a.accountName || a.accountId}
              <span className="text-xs text-muted-foreground">({a.anomalyCount} 筆)</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {a.anomalies.slice(0, 3).map((an, i) => (
                <li key={i}>· {an.title || an.description || "異常"}</li>
              ))}
              {a.anomalies.length > 3 && <li>…共 {a.anomalies.length} 筆</li>}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
