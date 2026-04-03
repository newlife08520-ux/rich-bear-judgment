/**
 * Meta / 帳號連動相關路由：meta-accounts、favorite-accounts、accounts/sync、accounts/synced、meta/pages、sync-selected
 */
import type { Express, RequestHandler } from "express";
import { storage } from "../storage";
import { syncMetaAccounts, syncGA4Properties } from "../account-sync";
import { META_ACCOUNT_STATUS_MAP } from "@shared/schema";
import type { MetaAdAccount, SyncedAccount } from "@shared/schema";

export function registerMetaConnectRoutes(app: Express, requireAuth: RequestHandler): void {
  app.get("/api/fb-ads/meta-accounts", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const token = settings.fbAccessToken?.trim();
    if (!token) {
      return res.json({ accounts: [], totalCount: 0, message: "請先設定 Facebook Access Token 並同步帳號" });
    }
    try {
      const acctRes = await fetch(
        `https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name,account_status,currency,timezone_name&limit=500&access_token=${encodeURIComponent(token)}`
      );
      const acctData = await acctRes.json();
      if (!acctRes.ok || !acctData.data) {
        const errMsg = acctData.error?.message || "取得帳號失敗";
        if (acctData.error?.code === 190) {
          return res.json({ accounts: [], totalCount: 0, message: "Facebook Access Token 已過期或無效" });
        }
        return res.json({ accounts: [], totalCount: 0, message: `取得帳號失敗: ${errMsg}` });
      }
      const favorites = storage.getFbFavoriteAccounts(userId);
      const favSet = new Set(favorites);
      const accounts: MetaAdAccount[] = (acctData.data as any[]).map((a: any) => ({
        accountId: a.account_id || a.id?.replace("act_", "") || "",
        name: a.name || "未命名",
        accountStatus: a.account_status || 0,
        accountStatusLabel: META_ACCOUNT_STATUS_MAP[a.account_status] || "未知",
        currency: a.currency || "USD",
        timezoneName: a.timezone_name || "",
        isFavorite: favSet.has(a.account_id || a.id?.replace("act_", "") || ""),
      }));
      const msg = accounts.length > 0
        ? `已取得 ${accounts.length} 個廣告帳號`
        : "Token 無效或尚未同步，請重新設定";
      return res.json({ accounts, totalCount: accounts.length, message: msg });
    } catch (err: any) {
      return res.json({ accounts: [], totalCount: 0, message: `呼叫 Meta API 失敗: ${(err.message || "").slice(0, 200)}` });
    }
  });

  app.get("/api/fb-ads/favorite-accounts", requireAuth, (req, res) => {
    const favorites = storage.getFbFavoriteAccounts(req.session.userId!);
    res.json({ favorites });
  });

  app.post("/api/fb-ads/favorite-accounts", requireAuth, (req, res) => {
    const { accountIds } = req.body;
    if (!Array.isArray(accountIds)) {
      return res.status(400).json({ message: "accountIds 必填且為陣列" });
    }
    const saved = storage.saveFbFavoriteAccounts(req.session.userId!, accountIds);
    res.json({ favorites: saved });
  });

  app.post("/api/accounts/sync", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const results = [];
    let allSyncedAccounts: SyncedAccount[] = [];

    if (settings.fbAccessToken?.trim()) {
      const metaResult = await syncMetaAccounts(settings.fbAccessToken, userId);
      results.push({ platform: metaResult.platform, success: metaResult.success, accountsSynced: metaResult.accountsSynced, message: metaResult.message, syncedAt: metaResult.syncedAt });
      if (metaResult.success && metaResult.accounts.length > 0) {
        allSyncedAccounts.push(...metaResult.accounts);
      }
    }

    if (settings.ga4PropertyId?.trim()) {
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const ga4Result = await syncGA4Properties(serviceAccountKey || "", settings.ga4PropertyId, userId);
      results.push(ga4Result);
      if (ga4Result.success) {
        allSyncedAccounts.push({
          id: `ga4-${settings.ga4PropertyId.trim()}`,
          userId,
          platform: "ga4",
          accountId: settings.ga4PropertyId.trim(),
          accountName: `GA4 Property ${settings.ga4PropertyId.trim()}`,
          status: "active",
          lastSyncedAt: new Date().toISOString(),
          isDefault: true,
        });
      }
    }

    if (allSyncedAccounts.length > 0) {
      storage.saveSyncedAccounts(userId, allSyncedAccounts);
    }

    if (results.length === 0) {
      return res.json({ results: [], message: "請至少設定 Facebook 或 GA4" });
    }

    res.json({ results, syncedAccounts: storage.getSyncedAccounts(userId) });
  });

  app.get("/api/accounts/synced", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const accounts = storage.getSyncedAccounts(userId);
    res.json({ accounts });
  });

  app.get("/api/meta/pages", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const token = settings.fbAccessToken?.trim();
    if (!token) {
      return res.json({ pages: [], igAccounts: [] });
    }
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
      );
      const pagesData = await pagesRes.json();
      if (!pagesRes.ok) {
        return res.status(400).json({ message: (pagesData as { error?: { message?: string } }).error?.message || "Meta API 錯誤" });
      }
      const rawPages = (pagesData as { data?: any[] }).data || [];
      const pages: { id: string; name: string }[] = rawPages.map((p: any) => ({ id: p.id, name: p.name || p.id }));
      const igAccounts: { id: string; username: string; pageId: string }[] = [];
      for (const p of rawPages) {
        const ig = p.instagram_business_account;
        if (ig?.id) {
          igAccounts.push({ id: ig.id, username: ig.username || ig.id, pageId: p.id });
        }
      }
      return res.json({ pages, igAccounts });
    } catch (err: any) {
      return res.status(500).json({ message: `Meta API 錯誤: ${(err.message || "").slice(0, 200)}` });
    }
  });

  app.get("/api/meta/pages-by-account", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const accountId = (req.query.accountId as string)?.trim();
    if (!accountId) {
      return res.status(400).json({ message: "請提供 accountId", pages: [], igAccounts: [] });
    }
    const settings = storage.getSettings(userId);
    const token = settings.fbAccessToken?.trim();
    if (!token) {
      return res.json({ pages: [], igAccounts: [], message: "請先設定 Facebook Access Token" });
    }
    const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
    try {
      const promoteRes = await fetch(
        `https://graph.facebook.com/v19.0/${actId}/promote_pages?access_token=${encodeURIComponent(token)}`
      );
      const promoteData = await promoteRes.json();
      if (!promoteRes.ok) {
        const errMsg = (promoteData as { error?: { message?: string; code?: number } }).error?.message || "Meta API 錯誤";
        const fallbackRes = await fetch(
          `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
        );
        const fallbackData = await fallbackRes.json();
        if (!fallbackRes.ok) {
          return res.status(400).json({ message: errMsg, pages: [], igAccounts: [] });
        }
        const raw = (fallbackData as { data?: any[] }).data || [];
        const pages: { id: string; name: string }[] = raw.map((p: any) => ({ id: p.id, name: p.name || p.id }));
        const igAccounts: { id: string; username: string; pageId: string }[] = [];
        for (const p of raw) {
          const ig = p.instagram_business_account;
          if (ig?.id) igAccounts.push({ id: ig.id, username: ig.username || ig.id, pageId: p.id });
        }
        return res.json({ pages, igAccounts, noFilterByAccount: true, message: "無法依廣告帳號篩選頁面，已回傳 Token 可存取之 FB/IG 頁面" });
      }
      const rawPages = (promoteData as { data?: any[] }).data || [];
      const pages: { id: string; name: string }[] = rawPages.map((p: any) => ({ id: p.id, name: p.name || p.id }));
      const igAccounts: { id: string; username: string; pageId: string }[] = [];
      for (const p of rawPages) {
        const pageId = p.id;
        const pageDetailRes = await fetch(
          `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
        );
        const pageDetail = await pageDetailRes.json();
        const ig = (pageDetail as { instagram_business_account?: { id: string; username?: string } }).instagram_business_account;
        if (ig?.id) {
          igAccounts.push({ id: ig.id, username: ig.username || ig.id, pageId });
        }
      }
      return res.json({ pages, igAccounts });
    } catch (err: any) {
      return res.status(500).json({ message: `Meta API 錯誤: ${(err.message || "").slice(0, 200)}`, pages: [], igAccounts: [] });
    }
  });

  app.post("/api/accounts/sync-selected", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const { platform, accountIds } = req.body;
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ message: "accountIds 必填且為陣列" });
    }

    const settings = storage.getSettings(userId);
    const existing = storage.getSyncedAccounts(userId);

    if (platform === "meta") {
      const token = settings.fbAccessToken?.trim();
      if (!token) {
        return res.status(400).json({ message: "請先設定 Facebook Access Token" });
      }
      try {
        const acctRes = await fetch(
          `https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name,account_status,currency,timezone_name&limit=500&access_token=${encodeURIComponent(token)}`
        );
        const acctData = await acctRes.json();
        if (!acctRes.ok || !acctData.data) {
          return res.status(400).json({ message: acctData.error?.message || "Meta API 錯誤" });
        }
        const selectedSet = new Set(accountIds);
        const now = new Date().toISOString();
        const newMeta: SyncedAccount[] = (acctData.data as any[])
          .filter((a: any) => selectedSet.has(a.account_id || a.id?.replace("act_", "") || ""))
          .map((a: any, idx: number) => ({
            id: `meta-${a.account_id || a.id?.replace("act_", "")}`,
            userId,
            platform: "meta" as const,
            accountId: a.account_id || a.id?.replace("act_", "") || "",
            accountName: a.name || "未命名",
            status: a.account_status === 1 ? "active" as const : "disconnected" as const,
            lastSyncedAt: now,
            isDefault: idx === 0,
            currency: a.currency || "USD",
            timezoneName: a.timezone_name || "",
            metaAccountStatus: a.account_status,
          }));

        const nonMeta = existing.filter(a => a.platform !== "meta");
        const merged = [...nonMeta, ...newMeta];
        storage.saveSyncedAccounts(userId, merged);
        console.log(`[SyncSelected] Synced ${newMeta.length} Meta accounts for user=${userId}`);
        return res.json({ success: true, syncedCount: newMeta.length, accounts: merged });
      } catch (err: any) {
        return res.status(500).json({ message: `Meta API 錯誤: ${(err.message || "").slice(0, 200)}` });
      }
    }

    if (platform === "ga4") {
      const now = new Date().toISOString();
      const nonGA4 = existing.filter(a => a.platform !== "ga4");
      const newGA4: SyncedAccount[] = accountIds.map((propId: string, idx: number) => ({
        id: `ga4-${propId}`,
        userId,
        platform: "ga4" as const,
        accountId: propId,
        accountName: `GA4 Property ${propId}`,
        status: "active" as const,
        lastSyncedAt: now,
        isDefault: idx === 0,
      }));
      const merged = [...nonGA4, ...newGA4];
      storage.saveSyncedAccounts(userId, merged);
      console.log(`[SyncSelected] Synced ${newGA4.length} GA4 properties for user=${userId}`);
      return res.json({ success: true, syncedCount: newGA4.length, accounts: merged });
    }

    return res.status(400).json({ message: `不支援的 platform: ${platform}` });
  });
}
