import type { SyncedAccount, AccountSyncResult, PlatformConnection } from "@shared/schema";
import { randomUUID } from "crypto";

export interface SyncMetaResult extends AccountSyncResult {
  accounts: SyncedAccount[];
}

export async function syncMetaAccounts(
  fbAccessToken: string,
  userId: string
): Promise<SyncMetaResult> {
  const syncedAt = new Date().toISOString();
  const empty: SyncMetaResult = { platform: "meta", success: false, accountsSynced: 0, message: "", syncedAt, accounts: [] };

  if (!fbAccessToken?.trim()) {
    return { ...empty, message: "未設定 Facebook Access Token" };
  }

  try {
    const token = fbAccessToken.trim();
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name,account_status,currency,timezone_name&limit=500&access_token=${encodeURIComponent(token)}`
    );
    const data = await res.json();

    if (!res.ok || !data.data) {
      const errMsg = data.error?.message || "未知錯誤";
      if (data.error?.code === 190) {
        return { ...empty, message: "Access Token 已過期或無效" };
      }
      return { ...empty, message: `無法取得廣告帳號: ${errMsg}` };
    }

    const accounts: SyncedAccount[] = (data.data as any[]).map((a: any, idx: number) => ({
      id: `meta-${a.account_id || a.id?.replace("act_", "") || randomUUID().slice(0, 8)}`,
      userId,
      platform: "meta" as const,
      accountId: a.account_id || a.id?.replace("act_", "") || "",
      accountName: a.name || "未命名帳號",
      status: a.account_status === 1 ? "active" as const : "disconnected" as const,
      lastSyncedAt: syncedAt,
      isDefault: idx === 0,
      currency: a.currency || "USD",
      timezoneName: a.timezone_name || "",
      metaAccountStatus: a.account_status,
    }));

    return {
      platform: "meta",
      success: true,
      accountsSynced: accounts.length,
      message: accounts.length > 0
        ? `已同步 ${accounts.length} 個 Meta 廣告帳號`
        : "Token 有效但無可用廣告帳號",
      syncedAt,
      accounts,
    };
  } catch (err: any) {
    const safeMsg = (err.message || "").replace(/access_token=[^&\s]+/gi, "access_token=***").slice(0, 200);
    return { ...empty, message: `Meta API 連線失敗: ${safeMsg}` };
  }
}

export async function syncGA4Properties(
  serviceAccountKey: string | undefined,
  propertyId: string,
  userId: string
): Promise<AccountSyncResult> {
  const syncedAt = new Date().toISOString();

  if (!serviceAccountKey) {
    return { platform: "ga4", success: false, accountsSynced: 0, message: "未設定 Google Service Account 憑證", syncedAt };
  }

  if (!propertyId?.trim()) {
    return { platform: "ga4", success: false, accountsSynced: 0, message: "未設定 GA4 Property ID", syncedAt };
  }

  try {
    const { GoogleAuth } = await import("google-auth-library");
    const credentials = JSON.parse(serviceAccountKey);
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();

    if (!tokenRes.token) {
      return { platform: "ga4", success: false, accountsSynced: 0, message: "無法取得 GA4 存取權杖", syncedAt };
    }

    const testRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId.trim()}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRes.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "activeUsers" }],
          limit: 1,
        }),
      }
    );

    if (testRes.ok) {
      return {
        platform: "ga4",
        success: true,
        accountsSynced: 1,
        message: `已同步 GA4 Property ${propertyId.trim()}`,
        syncedAt,
      };
    }

    const errData = await testRes.json();
    return {
      platform: "ga4",
      success: false,
      accountsSynced: 0,
      message: `GA4 驗證失敗: ${errData.error?.message || "未知錯誤"}`,
      syncedAt,
    };
  } catch (err: any) {
    return {
      platform: "ga4",
      success: false,
      accountsSynced: 0,
      message: `GA4 連線失敗: ${(err.message || "").slice(0, 200)}`,
      syncedAt,
    };
  }
}

export function buildPlatformConnections(
  syncedAccounts: SyncedAccount[],
  metaSyncResult?: AccountSyncResult,
  ga4SyncResult?: AccountSyncResult
): PlatformConnection[] {
  const metaAccounts = syncedAccounts.filter(a => a.platform === "meta");
  const ga4Accounts = syncedAccounts.filter(a => a.platform === "ga4");

  return [
    {
      platform: "meta",
      connected: metaAccounts.length > 0,
      accountCount: metaAccounts.length,
      lastSyncedAt: metaSyncResult?.syncedAt || metaAccounts[0]?.lastSyncedAt || null,
    },
    {
      platform: "ga4",
      connected: ga4Accounts.length > 0,
      accountCount: ga4Accounts.length,
      lastSyncedAt: ga4SyncResult?.syncedAt || ga4Accounts[0]?.lastSyncedAt || null,
    },
  ];
}
