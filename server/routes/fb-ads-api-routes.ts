/**
 * Meta / FB Ads 唯讀 API（batch 衍生），由 routes 組合掛載；邏輯與原 routes.ts 相同。
 */
import type { Express, Request, Response, NextFunction } from "express";
import type { AnalysisBatch } from "@shared/schema";
import {
  buildRealFbOverview,
  buildRealFbCreatives,
  buildRealFbDirectorSummary,
  buildRealCampaignStructure,
  buildRealBudgetRecommendations,
  buildRealAlerts,
  buildRealHighRiskItems,
} from "../real-data-transformers";

type AuthMw = (req: Request, res: Response, next: NextFunction) => void;

export function registerFbAdsApiRoutes(
  app: Express,
  requireAuth: AuthMw,
  getBatchFromRequest: (req: Request) => AnalysisBatch | null,
): void {
  app.get("/api/fb-ads/overview", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json(null);
    res.json(buildRealFbOverview(batch.campaignMetrics));
  });

  app.get("/api/fb-ads/creatives", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    const search = req.query.search as string | undefined;
    res.json(buildRealFbCreatives(batch.campaignMetrics, search));
  });

  app.get("/api/fb-ads/director-summary", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.summary) return res.json(null);
    res.json(buildRealFbDirectorSummary(batch.summary));
  });

  app.get("/api/fb-ads/buried-gems", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    const creatives = buildRealFbCreatives(batch.campaignMetrics);
    res.json(creatives.filter((c) => c.aiLabel === "?????????"));
  });

  app.get("/api/fb-ads/stop-list", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    const creatives = buildRealFbCreatives(batch.campaignMetrics);
    res.json(creatives.filter((c) => ["待觀察", "忽略"].includes(c.aiLabel)));
  });

  app.get("/api/fb-ads/campaign-structure", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);

    const adsetData = batch.adsetMetrics;
    const adData = batch.adMetrics;
    const structures = buildRealCampaignStructure(batch.campaignMetrics, adsetData, adData);

    if (!adsetData || adsetData.length === 0) {
      structures.push({
        id: "placeholder-adset-info",
        name: "Ad Set ????????????API ???",
        level: "adset",
        spend: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        roas: 0,
        frequency: 0,
        conversions: 0,
        aiLabel: "???",
        aiComment: "Ad Set ????????????API ????????? Meta Access Token ???? ads_read ???",
        judgmentScore: 0,
        opportunityScore: 0,
        recommendationLevel: "ignore",
      });
    }

    res.json(structures);
  });

  app.get("/api/fb-ads/budget-recommendations", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    res.json(buildRealBudgetRecommendations(batch.campaignMetrics));
  });

  app.get("/api/fb-ads/alerts", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    res.json(buildRealAlerts(batch.campaignMetrics));
  });

  app.get("/api/fb-ads/high-risk", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    res.json(buildRealHighRiskItems(batch.campaignMetrics));
  });

  app.get("/api/fb-ads/opportunities", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.opportunities || batch.opportunities.length === 0) {
      return res.json({ opportunities: [] });
    }
    res.json({ opportunities: batch.opportunities });
  });

  app.get("/api/fb-ads/campaigns-scored", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.campaignMetrics || batch.campaignMetrics.length === 0) {
      return res.json({ campaigns: [] });
    }
    res.json({ campaigns: batch.campaignMetrics });
  });
}
