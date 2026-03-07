import type { GA4FunnelMetrics, GA4PageMetricsDetailed, TriScore, RiskLevel } from "@shared/schema";
import { resolveDateRange, classifyPageGroup } from "@shared/schema";

async function getGA4AccessToken(serviceAccountKey: string): Promise<string | null> {
  try {
    const { GoogleAuth } = await import("google-auth-library");
    const credentials = JSON.parse(serviceAccountKey);
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    return tokenRes.token || null;
  } catch (err: any) {
    console.error("[GA4Fetcher] Auth error:", err.message);
    return null;
  }
}

async function runGA4Report(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string,
  metrics: string[],
  dimensions?: string[]
): Promise<any[]> {
  const body: any = {
    dateRanges: [{ startDate, endDate }],
    metrics: metrics.map(name => ({ name })),
    limit: 1000,
  };
  if (dimensions?.length) {
    body.dimensions = dimensions.map(name => ({ name }));
  }

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    console.error(`[GA4Fetcher] Report error:`, data.error?.message);
    return [];
  }

  return data.rows || [];
}

export async function fetchGA4FunnelData(
  serviceAccountKey: string,
  propertyId: string,
  propertyName: string,
  datePreset: string = "7",
  customStart?: string,
  customEnd?: string
): Promise<GA4FunnelMetrics | null> {
  if (!serviceAccountKey || !propertyId?.trim()) {
    console.log("[GA4Fetcher] Missing credentials or property ID");
    return null;
  }

  const accessToken = await getGA4AccessToken(serviceAccountKey);
  if (!accessToken) return null;

  const dateRange = resolveDateRange(datePreset, customStart, customEnd);
  const pid = propertyId.trim();

  try {
    console.log(`[GA4Fetcher] Fetching funnel data for property ${pid}, period: ${dateRange.startDate} ~ ${dateRange.endDate}`);

    const [currentRows, prevRows] = await Promise.all([
      runGA4Report(
        accessToken,
        pid,
        dateRange.startDate,
        dateRange.endDate,
        ["sessions", "screenPageViews", "addToCarts", "checkouts", "ecommercePurchases", "purchaseRevenue"]
      ),
      runGA4Report(
        accessToken,
        pid,
        dateRange.comparisonStartDate,
        dateRange.comparisonEndDate,
        ["sessions", "screenPageViews", "addToCarts", "checkouts", "ecommercePurchases", "purchaseRevenue"]
      ),
    ]);

    const getVal = (rows: any[], idx: number) => {
      if (!rows.length) return 0;
      return parseFloat(rows[0].metricValues?.[idx]?.value || "0");
    };

    const sessions = getVal(currentRows, 0);
    const pageviews = getVal(currentRows, 1);
    const addToCart = getVal(currentRows, 2);
    const beginCheckout = getVal(currentRows, 3);
    const purchases = getVal(currentRows, 4);
    const revenue = getVal(currentRows, 5);

    const sessionsPrev = getVal(prevRows, 0);
    const addToCartPrev = getVal(prevRows, 2);
    const beginCheckoutPrev = getVal(prevRows, 3);
    const purchasesPrev = getVal(prevRows, 4);
    const revenuePrev = getVal(prevRows, 5);

    const conversionRate = sessions > 0 ? (purchases / sessions) * 100 : 0;
    const conversionRatePrev = sessionsPrev > 0 ? (purchasesPrev / sessionsPrev) * 100 : 0;
    const checkoutAbandonmentRate = beginCheckout > 0 ? ((beginCheckout - purchases) / beginCheckout) * 100 : 0;
    const checkoutAbandonmentRatePrev = beginCheckoutPrev > 0 ? ((beginCheckoutPrev - purchasesPrev) / beginCheckoutPrev) * 100 : 0;

    const result: GA4FunnelMetrics = {
      propertyId: pid,
      propertyName,
      sessions,
      pageviews,
      addToCart,
      beginCheckout,
      purchases,
      revenue,
      sessionsPrev,
      addToCartPrev,
      beginCheckoutPrev,
      purchasesPrev,
      revenuePrev,
      conversionRate,
      conversionRatePrev,
      checkoutAbandonmentRate,
      checkoutAbandonmentRatePrev,
      addToCartRate: sessions > 0 ? (addToCart / sessions) * 100 : 0,
      beginCheckoutRate: addToCart > 0 ? (beginCheckout / addToCart) * 100 : 0,
      purchaseRate: beginCheckout > 0 ? (purchases / beginCheckout) * 100 : 0,
    };

    console.log(`[GA4Fetcher] Processed funnel data: sessions=${sessions}, purchases=${purchases}, revenue=${revenue}`);
    return result;
  } catch (err: any) {
    console.error(`[GA4Fetcher] Error:`, err.message);
    return null;
  }
}

export async function fetchGA4PageData(
  serviceAccountKey: string,
  propertyId: string,
  datePreset: string = "7",
  customStart?: string,
  customEnd?: string
): Promise<GA4PageMetricsDetailed[]> {
  if (!serviceAccountKey || !propertyId?.trim()) {
    console.log("[GA4Fetcher] Missing credentials or property ID for page data");
    return [];
  }

  const accessToken = await getGA4AccessToken(serviceAccountKey);
  if (!accessToken) return [];

  const dateRange = resolveDateRange(datePreset, customStart, customEnd);
  const pid = propertyId.trim();

  try {
    console.log(`[GA4Fetcher] Fetching page-level data for property ${pid}, period: ${dateRange.startDate} ~ ${dateRange.endDate}`);

    const pageMetrics = [
      "sessions",
      "screenPageViews",
      "averageSessionDuration",
      "bounceRate",
      "addToCarts",
      "checkouts",
      "ecommercePurchases",
      "purchaseRevenue",
    ];

    const pageDimensions = ["pagePath", "pageTitle"];

    const [currentRows, prevRows] = await Promise.all([
      runGA4Report(accessToken, pid, dateRange.startDate, dateRange.endDate, pageMetrics, pageDimensions),
      runGA4Report(accessToken, pid, dateRange.comparisonStartDate, dateRange.comparisonEndDate, pageMetrics, pageDimensions),
    ]);

    const prevMap = new Map<string, {
      sessions: number;
      conversionRate: number;
      revenue: number;
      bounceRate: number;
    }>();

    for (const row of prevRows) {
      const path = row.dimensionValues?.[0]?.value || "";
      const sess = parseFloat(row.metricValues?.[0]?.value || "0");
      const purch = parseFloat(row.metricValues?.[6]?.value || "0");
      const rev = parseFloat(row.metricValues?.[7]?.value || "0");
      const br = parseFloat(row.metricValues?.[3]?.value || "0");
      const cvr = sess > 0 ? (purch / sess) * 100 : 0;
      const existing = prevMap.get(path);
      if (existing) {
        existing.sessions += sess;
        existing.revenue += rev;
        existing.bounceRate = (existing.bounceRate + br) / 2;
        const totalPurch = (existing.conversionRate * existing.sessions / 100) + purch;
        existing.conversionRate = existing.sessions > 0 ? (totalPurch / existing.sessions) * 100 : 0;
      } else {
        prevMap.set(path, { sessions: sess, conversionRate: cvr, revenue: rev, bounceRate: br });
      }
    }

    const pageMap = new Map<string, GA4PageMetricsDetailed>();

    for (const row of currentRows) {
      const pagePath = row.dimensionValues?.[0]?.value || "";
      const pageTitle = row.dimensionValues?.[1]?.value || "";

      const sessions = parseFloat(row.metricValues?.[0]?.value || "0");
      const pageviews = parseFloat(row.metricValues?.[1]?.value || "0");
      const avgEngagementTime = parseFloat(row.metricValues?.[2]?.value || "0");
      const bounceRate = parseFloat(row.metricValues?.[3]?.value || "0");
      const addToCart = parseFloat(row.metricValues?.[4]?.value || "0");
      const beginCheckout = parseFloat(row.metricValues?.[5]?.value || "0");
      const purchases = parseFloat(row.metricValues?.[6]?.value || "0");
      const revenue = parseFloat(row.metricValues?.[7]?.value || "0");
      const conversionRate = sessions > 0 ? (purchases / sessions) * 100 : 0;

      const prev = prevMap.get(pagePath);
      const pageGroup = classifyPageGroup(pagePath);

      const existing = pageMap.get(pagePath);
      if (existing) {
        existing.sessions += sessions;
        existing.pageviews += pageviews;
        existing.avgEngagementTime = (existing.avgEngagementTime + avgEngagementTime) / 2;
        existing.bounceRate = (existing.bounceRate + bounceRate) / 2;
        existing.addToCart += addToCart;
        existing.beginCheckout += beginCheckout;
        existing.purchases += purchases;
        existing.revenue += revenue;
        existing.conversionRate = existing.sessions > 0 ? (existing.purchases / existing.sessions) * 100 : 0;
        if (!existing.pageTitle && pageTitle) {
          existing.pageTitle = pageTitle;
        }
      } else {
        const triScore = computePageTriScore(sessions, conversionRate, bounceRate, revenue, prev);
        const riskLevel = classifyPageRiskLevel(triScore, conversionRate, bounceRate, sessions);

        pageMap.set(pagePath, {
          pagePath,
          pageTitle: pageTitle || pagePath,
          pageGroup,
          sessions,
          pageviews,
          avgEngagementTime,
          bounceRate,
          addToCart,
          beginCheckout,
          purchases,
          revenue,
          conversionRate,
          sessionsPrev: prev?.sessions ?? 0,
          conversionRatePrev: prev?.conversionRate ?? 0,
          revenuePrev: prev?.revenue ?? 0,
          bounceRatePrev: prev?.bounceRate ?? 0,
          triScore,
          riskLevel,
        });
      }
    }

    const results = Array.from(pageMap.values());

    for (const page of results) {
      if (page.sessions > 0) {
        const prev = prevMap.get(page.pagePath);
        page.triScore = computePageTriScore(page.sessions, page.conversionRate, page.bounceRate, page.revenue, prev);
        page.riskLevel = classifyPageRiskLevel(page.triScore, page.conversionRate, page.bounceRate, page.sessions);
      }
    }

    results.sort((a, b) => b.sessions - a.sessions);

    console.log(`[GA4Fetcher] Processed ${results.length} pages with page-level data`);
    return results;
  } catch (err: any) {
    console.error(`[GA4Fetcher] Page data error:`, err.message);
    return [];
  }
}

function computePageTriScore(
  sessions: number,
  conversionRate: number,
  bounceRate: number,
  revenue: number,
  prev?: { sessions: number; conversionRate: number; revenue: number; bounceRate: number }
): TriScore {
  const health = Math.min(100, Math.round(
    Math.min(conversionRate * 10, 30) +
    Math.min(Math.max(0, (100 - bounceRate)) * 0.3, 30) +
    Math.min(sessions * 0.05, 20) +
    Math.min(revenue * 0.01, 20)
  ));

  let urgency = 0;
  if (prev) {
    const cvrDelta = prev.conversionRate > 0 ? ((conversionRate - prev.conversionRate) / prev.conversionRate) * 100 : 0;
    const revDelta = prev.revenue > 0 ? ((revenue - prev.revenue) / prev.revenue) * 100 : 0;
    const sessDelta = prev.sessions > 0 ? ((sessions - prev.sessions) / prev.sessions) * 100 : 0;
    const brDelta = prev.bounceRate > 0 ? ((bounceRate - prev.bounceRate) / prev.bounceRate) * 100 : 0;

    if (cvrDelta < -10) urgency += Math.min(Math.abs(cvrDelta), 30);
    if (revDelta < -10) urgency += Math.min(Math.abs(revDelta) * 0.5, 25);
    if (sessDelta < -20) urgency += Math.min(Math.abs(sessDelta) * 0.3, 20);
    if (brDelta > 10) urgency += Math.min(brDelta * 0.5, 15);
    if (bounceRate > 80) urgency += 10;
  } else {
    if (bounceRate > 80) urgency += 30;
    if (conversionRate < 0.5) urgency += 20;
  }
  urgency = Math.min(100, Math.round(urgency));

  const scalePotential = Math.min(100, Math.round(
    Math.min(conversionRate * 8, 30) +
    Math.min(Math.max(0, (100 - bounceRate)) * 0.25, 25) +
    (revenue > 0 ? Math.min(revenue * 0.02, 25) : 0) +
    (sessions < 100 && conversionRate > 1 ? 20 : 0)
  ));

  return { health, urgency, scalePotential };
}

function classifyPageRiskLevel(
  triScore: TriScore,
  conversionRate: number,
  bounceRate: number,
  sessions: number
): RiskLevel {
  if (triScore.health < 20 && triScore.urgency > 70) return "danger";
  if (triScore.health < 40 && triScore.urgency > 50) return "warning";
  if (bounceRate > 80 && sessions > 50) return "warning";
  if (triScore.urgency > 40 || (bounceRate > 70 && conversionRate < 0.5)) return "watch";
  if (triScore.scalePotential > 60 && triScore.health > 50) return "potential";
  return "stable";
}
