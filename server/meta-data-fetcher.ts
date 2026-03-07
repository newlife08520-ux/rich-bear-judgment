import type { CampaignMetrics, MultiWindowMetrics, WindowSnapshot, AdSetMetrics, AdMetrics } from "@shared/schema";
import { resolveDateRange } from "@shared/schema";

export async function fetchMetaCampaignData(
  fbAccessToken: string,
  adAccountId: string,
  accountName: string,
  datePreset: string = "7",
  customStart?: string,
  customEnd?: string
): Promise<CampaignMetrics[]> {
  if (!fbAccessToken?.trim()) {
    console.log("[MetaFetcher] No access token, returning empty");
    return [];
  }

  const token = fbAccessToken.trim();
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const dateRange = resolveDateRange(datePreset, customStart, customEnd);

  try {
    console.log(`[MetaFetcher] Fetching campaigns for ${actId}, period: ${dateRange.startDate} ~ ${dateRange.endDate}`);

    const [campaignsRes, insightsRes, prevInsightsRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v19.0/${actId}/campaigns?fields=id,name,status,objective&limit=100&access_token=${encodeURIComponent(token)}`),
      fetch(`https://graph.facebook.com/v19.0/${actId}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,frequency&level=campaign&time_range={"since":"${dateRange.startDate}","until":"${dateRange.endDate}"}&limit=500&access_token=${encodeURIComponent(token)}`),
      fetch(`https://graph.facebook.com/v19.0/${actId}/insights?fields=campaign_id,spend,ctr,cpc,actions&level=campaign&time_range={"since":"${dateRange.comparisonStartDate}","until":"${dateRange.comparisonEndDate}"}&limit=500&access_token=${encodeURIComponent(token)}`),
    ]);

    const [campaignsData, insightsData, prevInsightsData] = await Promise.all([
      campaignsRes.json(),
      insightsRes.json(),
      prevInsightsRes.json(),
    ]);

    if (!campaignsRes.ok || !campaignsData.data) {
      console.error(`[MetaFetcher] Failed to fetch campaigns:`, campaignsData.error?.message);
      return [];
    }

    const campaigns = campaignsData.data as any[];
    console.log(`[MetaFetcher] Found ${campaigns.length} campaigns`);

    const insightsMap = new Map<string, any>();
    if (insightsData.data) {
      for (const row of insightsData.data) {
        insightsMap.set(row.campaign_id, row);
      }
    }

    const prevMap = new Map<string, any>();
    if (prevInsightsData.data) {
      for (const row of prevInsightsData.data) {
        prevMap.set(row.campaign_id, row);
      }
    }

    console.log(`[MetaFetcher] Got ${insightsMap.size} campaign insights, ${prevMap.size} comparison insights`);

    const results: CampaignMetrics[] = campaigns.map((c: any) => {
      const ins = insightsMap.get(c.id) || {};
      const prev = prevMap.get(c.id) || {};

      const spend = parseFloat(ins.spend || "0");
      const impressions = parseInt(ins.impressions || "0");
      const clicks = parseInt(ins.clicks || "0");
      const ctr = parseFloat(ins.ctr || "0");
      const cpc = parseFloat(ins.cpc || "0");
      const cpm = parseFloat(ins.cpm || "0");
      const frequency = parseFloat(ins.frequency || "0");

      let conversions = 0;
      let revenue = 0;
      let addToCart = 0;
      if (ins.actions) {
        const purchaseAction = ins.actions.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
        if (purchaseAction) conversions = parseInt(purchaseAction.value || "0");
        const atcAction = ins.actions.find((a: any) => a.action_type === "add_to_cart" || a.action_type === "omni_add_to_cart" || a.action_type === "offsite_conversion.fb_pixel_add_to_cart");
        if (atcAction) addToCart = parseInt(atcAction.value || "0");
      }
      if (ins.action_values) {
        const purchaseValue = ins.action_values.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
        if (purchaseValue) revenue = parseFloat(purchaseValue.value || "0");
      }

      const roas = spend > 0 ? revenue / spend : 0;
      const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;

      const prevSpend = parseFloat(prev.spend || "0");
      const prevCtr = parseFloat(prev.ctr || "0");
      const prevCpc = parseFloat(prev.cpc || "0");
      let prevConversions = 0;
      let prevRevenue = 0;
      if (prev.actions) {
        const pa = prev.actions.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
        if (pa) prevConversions = parseInt(pa.value || "0");
      }
      const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : 0;
      const prevClicks = parseInt(prev.clicks || "0");
      const prevCvr = prevClicks > 0 ? (prevConversions / prevClicks) * 100 : 0;

      return {
        accountId: adAccountId,
        accountName,
        campaignId: c.id,
        campaignName: c.name || "未命名活動",
        status: c.status?.toLowerCase() || "unknown",
        spend,
        revenue,
        roas,
        impressions,
        clicks,
        ctr,
        cpc,
        cpm,
        conversions,
        addToCart: addToCart || undefined,
        frequency,
        spendPrev: prevSpend,
        roasPrev: prevRoas,
        ctrPrev: prevCtr,
        cpcPrev: prevCpc,
        cvrPrev: prevCvr,
      };
    });

    console.log(`[MetaFetcher] Processed ${results.length} campaigns for ${actId}`);
    return results;
  } catch (err: any) {
    console.error(`[MetaFetcher] Error fetching data for ${actId}:`, err.message);
    return [];
  }
}

export async function fetchMetaAdSetAndAdData(
  fbAccessToken: string,
  adAccountId: string,
  datePreset: string = "7",
  customStart?: string,
  customEnd?: string
): Promise<{ adsets: AdSetMetrics[]; ads: AdMetrics[] }> {
  if (!fbAccessToken?.trim()) {
    console.log("[MetaFetcher] No access token for adset/ad fetch, returning empty");
    return { adsets: [], ads: [] };
  }

  const token = fbAccessToken.trim();
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const dateRange = resolveDateRange(datePreset, customStart, customEnd);

  try {
    console.log(`[MetaFetcher] Fetching adset & ad data for ${actId}, period: ${dateRange.startDate} ~ ${dateRange.endDate}`);

    const timeRange = `{"since":"${dateRange.startDate}","until":"${dateRange.endDate}"}`;
    const insightFields = "campaign_id,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,frequency";

    const [adsetListRes, adsetInsightsRes, adListRes, adInsightsRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v19.0/${actId}/adsets?fields=id,name,status,campaign_id&limit=200&access_token=${encodeURIComponent(token)}`),
      fetch(`https://graph.facebook.com/v19.0/${actId}/insights?fields=${insightFields}&level=adset&time_range=${timeRange}&limit=500&access_token=${encodeURIComponent(token)}`),
      fetch(`https://graph.facebook.com/v19.0/${actId}/ads?fields=id,name,status,campaign_id,adset_id&limit=200&access_token=${encodeURIComponent(token)}`),
      fetch(`https://graph.facebook.com/v19.0/${actId}/insights?fields=${insightFields}&level=ad&time_range=${timeRange}&limit=500&access_token=${encodeURIComponent(token)}`),
    ]);

    const [adsetListData, adsetInsightsData, adListData, adInsightsData] = await Promise.all([
      adsetListRes.json(),
      adsetInsightsRes.json(),
      adListRes.json(),
      adInsightsRes.json(),
    ]);

    const adsetInsightsMap = new Map<string, any>();
    if (adsetInsightsData.data) {
      for (const row of adsetInsightsData.data) {
        adsetInsightsMap.set(row.adset_id, row);
      }
    }

    const adInsightsMap = new Map<string, any>();
    if (adInsightsData.data) {
      for (const row of adInsightsData.data) {
        adInsightsMap.set(row.ad_id, row);
      }
    }

    const adsets: AdSetMetrics[] = [];
    if (adsetListData.data) {
      for (const as of adsetListData.data) {
        const ins = adsetInsightsMap.get(as.id) || {};
        const spend = parseFloat(ins.spend || "0");
        const impressions = parseInt(ins.impressions || "0");
        const clicks = parseInt(ins.clicks || "0");
        const ctr = parseFloat(ins.ctr || "0");
        const cpc = parseFloat(ins.cpc || "0");
        const cpm = parseFloat(ins.cpm || "0");
        const frequency = parseFloat(ins.frequency || "0");

        let conversions = 0;
        let revenue = 0;
        if (ins.actions) {
          const pa = ins.actions.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
          if (pa) conversions = parseInt(pa.value || "0");
        }
        if (ins.action_values) {
          const pv = ins.action_values.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
          if (pv) revenue = parseFloat(pv.value || "0");
        }
        const roas = spend > 0 ? revenue / spend : 0;

        adsets.push({
          id: as.id,
          name: as.name || "未命名廣告組",
          status: as.status?.toLowerCase() || "unknown",
          campaignId: as.campaign_id || "",
          spend, impressions, clicks, ctr, cpc, cpm, roas, frequency, conversions, revenue,
        });
      }
    }

    const ads: AdMetrics[] = [];
    if (adListData.data) {
      for (const ad of adListData.data) {
        const ins = adInsightsMap.get(ad.id) || {};
        const spend = parseFloat(ins.spend || "0");
        const impressions = parseInt(ins.impressions || "0");
        const clicks = parseInt(ins.clicks || "0");
        const ctr = parseFloat(ins.ctr || "0");
        const cpc = parseFloat(ins.cpc || "0");
        const cpm = parseFloat(ins.cpm || "0");
        const frequency = parseFloat(ins.frequency || "0");

        let conversions = 0;
        let revenue = 0;
        if (ins.actions) {
          const pa = ins.actions.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
          if (pa) conversions = parseInt(pa.value || "0");
        }
        if (ins.action_values) {
          const pv = ins.action_values.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
          if (pv) revenue = parseFloat(pv.value || "0");
        }
        const roas = spend > 0 ? revenue / spend : 0;

        ads.push({
          id: ad.id,
          name: ad.name || "未命名廣告",
          status: ad.status?.toLowerCase() || "unknown",
          campaignId: ad.campaign_id || "",
          adsetId: ad.adset_id || "",
          spend, impressions, clicks, ctr, cpc, cpm, roas, frequency, conversions, revenue,
        });
      }
    }

    console.log(`[MetaFetcher] Fetched ${adsets.length} adsets and ${ads.length} ads for ${actId}`);
    return { adsets, ads };
  } catch (err: any) {
    console.error(`[MetaFetcher] Error fetching adset/ad data for ${actId}:`, err.message);
    return { adsets: [], ads: [] };
  }
}

function emptySnapshot(): WindowSnapshot {
  return { spend: 0, revenue: 0, roas: 0, ctr: 0, cpc: 0, cpm: 0, cvr: 0, frequency: 0, impressions: 0, clicks: 0, conversions: 0 };
}

function parseInsightRow(row: any): WindowSnapshot {
  const spend = parseFloat(row.spend || "0");
  const impressions = parseInt(row.impressions || "0");
  const clicks = parseInt(row.clicks || "0");
  const ctr = parseFloat(row.ctr || "0");
  const cpc = parseFloat(row.cpc || "0");
  const cpm = parseFloat(row.cpm || "0");
  const frequency = parseFloat(row.frequency || "0");
  let conversions = 0;
  let revenue = 0;
  if (row.actions) {
    const pa = row.actions.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
    if (pa) conversions = parseInt(pa.value || "0");
  }
  if (row.action_values) {
    const pv = row.action_values.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
    if (pv) revenue = parseFloat(pv.value || "0");
  }
  const roas = spend > 0 ? revenue / spend : 0;
  const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
  return { spend, revenue, roas, ctr, cpc, cpm, cvr, frequency, impressions, clicks, conversions };
}

async function fetchWindowInsights(
  token: string,
  actId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, any>> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${actId}/insights?fields=campaign_id,spend,impressions,clicks,ctr,cpc,cpm,frequency,actions,action_values&level=campaign&time_range={"since":"${startDate}","until":"${endDate}"}&limit=500&access_token=${encodeURIComponent(token)}`
    );
    const data = await res.json();
    const map = new Map<string, any>();
    if (data.data) {
      for (const row of data.data) {
        map.set(row.campaign_id, row);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchMultiWindowMetrics(
  fbAccessToken: string,
  adAccountId: string,
  campaigns: CampaignMetrics[]
): Promise<Map<string, MultiWindowMetrics>> {
  const result = new Map<string, MultiWindowMetrics>();
  if (!fbAccessToken?.trim() || campaigns.length === 0) return result;

  const token = fbAccessToken.trim();
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const windows = [1, 3, 7, 14];
  const ranges = windows.map(days => {
    const dr = resolveDateRange(String(days));
    return { days, current: { start: dr.startDate, end: dr.endDate }, prev: { start: dr.comparisonStartDate, end: dr.comparisonEndDate } };
  });

  try {
    console.log(`[MetaFetcher] Fetching multi-window data for ${actId} (${windows.join("/")} days)`);
    const fetches = ranges.flatMap(r => [
      fetchWindowInsights(token, actId, r.current.start, r.current.end),
      fetchWindowInsights(token, actId, r.prev.start, r.prev.end),
    ]);
    const results = await Promise.all(fetches);

    for (const c of campaigns) {
      const mw: MultiWindowMetrics = {
        window1d: emptySnapshot(), window3d: emptySnapshot(), window7d: emptySnapshot(), window14d: emptySnapshot(),
        prev1d: emptySnapshot(), prev3d: emptySnapshot(), prev7d: emptySnapshot(), prev14d: emptySnapshot(),
      };

      const windowKeys: (keyof MultiWindowMetrics)[] = ["window1d", "prev1d", "window3d", "prev3d", "window7d", "prev7d", "window14d", "prev14d"];
      for (let i = 0; i < results.length; i++) {
        const row = results[i].get(c.campaignId);
        if (row) {
          mw[windowKeys[i]] = parseInsightRow(row);
        }
      }

      result.set(c.campaignId, mw);
    }

    console.log(`[MetaFetcher] Multi-window data populated for ${result.size} campaigns`);
  } catch (err: any) {
    console.error(`[MetaFetcher] Multi-window fetch error:`, err.message);
  }

  return result;
}
