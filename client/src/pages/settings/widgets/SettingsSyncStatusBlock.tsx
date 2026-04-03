import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SyncedAccount } from "@shared/schema";

export function SettingsSyncStatusBlock() {
  const { data: syncedData } = useQuery<{ accounts: SyncedAccount[] }>({
    queryKey: ["/api/accounts/synced"],
  });
  const { toast } = useToast();
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounts/sync", {});
      return res.json();
    },
    onSuccess: (data: { syncedAccounts?: SyncedAccount[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/synced"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      const count = data.syncedAccounts?.length ?? 0;
      toast({
        title: "帳號同步完成",
        description: count > 0 ? `已同步 ${count} 個帳號` : "未設定 FB/GA4 或同步無資料",
      });
    },
    onError: () => toast({ title: "帳號同步失敗", variant: "destructive" }),
  });
  const accounts = syncedData?.accounts ?? [];
  const metaAccounts = accounts.filter((a: SyncedAccount) => a.platform === "meta");
  const ga4Accounts = accounts.filter((a: SyncedAccount) => a.platform === "ga4");
  const metaLast =
    metaAccounts.length > 0
      ? metaAccounts.reduce(
          (latest: string, a: SyncedAccount) =>
            a.lastSyncedAt && a.lastSyncedAt > latest ? a.lastSyncedAt : latest,
          ""
        )
      : null;
  const ga4Last =
    ga4Accounts.length > 0
      ? ga4Accounts.reduce(
          (latest: string, a: SyncedAccount) =>
            a.lastSyncedAt && a.lastSyncedAt > latest ? a.lastSyncedAt : latest,
          ""
        )
      : null;
  const fmt = (ts: string | null) =>
    ts ? new Date(ts).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "尚未同步";
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-muted-foreground">
          Facebook：已同步 <span className="font-medium text-foreground">{metaAccounts.length}</span> 個廣告帳號
          {metaLast != null && <span className="ml-1 text-muted-foreground">· 最後同步 {fmt(metaLast)}</span>}
        </span>
        <span className="text-muted-foreground">
          GA4：已同步 <span className="font-medium text-foreground">{ga4Accounts.length}</span> 個 Property
          {ga4Last != null && <span className="ml-1 text-muted-foreground">· 最後同步 {fmt(ga4Last)}</span>}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
        className="gap-1.5"
      >
        {syncMutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
        {syncMutation.isPending ? "同步中..." : "立即同步帳號"}
      </Button>
    </div>
  );
}
