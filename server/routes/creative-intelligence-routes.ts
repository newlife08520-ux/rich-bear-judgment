import type { Express, Request, Response, RequestHandler } from "express";
import { storage } from "../storage";
import { runCreativeReviewFromAssetVersion } from "../modules/creative-intelligence/creative-review-runner";
import {
  findLatestReviewForVersion,
  listTagsForReviewIds,
} from "../modules/creative-intelligence/creative-review-prisma";
import {
  buildCreativePatternsPayload,
  buildDegradedCreativePatternsPayload,
  syncOutcomeSnapshotsFromBatch,
} from "../modules/creative-intelligence/creative-intelligence-patterns";
import { buildVersionTimelineEntries } from "../modules/creative-intelligence/creative-patterns-workbench";
import {
  ambiguityReasonLines,
  computeVersionAmbiguitySignals,
  confidenceFromSnapshot,
  linkAttributionSummary,
  whyWinningWhyLosing,
} from "../modules/creative-intelligence/attribution-confidence";
import {
  buildAttributionDebugForCampaign,
  buildAttributionDebugForVersion,
} from "../modules/creative-intelligence/attribution-debug";
import { prisma } from "../db";
import {
  createCreativeReviewJob,
  findActiveCreativeReviewJob,
  getCreativeReviewJob,
  serializeCreativeReviewJob,
} from "../modules/creative-intelligence/creative-review-job-prisma";
import * as assetVersionService from "../modules/asset/asset-version-service";
import { buildProductPatternPerformanceSummary } from "../modules/creative-intelligence/creative-product-pattern-performance";

function getParam(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

function getBatchFromRequest(req: Request) {
  const userId = req.session.userId!;
  const scopeKey = (req.query.scope as string) || undefined;
  return storage.getLatestBatch(userId, scopeKey);
}

export function registerCreativeIntelligenceRoutes(app: Express, requireAuth: RequestHandler) {
  app.get(
    "/api/creative-intelligence/attribution/debug/version/:assetVersionId",
    requireAuth,
    async (req, res) => {
      const userId = req.session.userId!;
      const assetVersionId = getParam(req, "assetVersionId");
      if (!assetVersionId) return res.status(400).json({ message: "缺少 assetVersionId" });
      const payload = await buildAttributionDebugForVersion(userId, assetVersionId);
      res.json(payload);
    }
  );

  app.get(
    "/api/creative-intelligence/attribution/debug/campaign/:externalCampaignId",
    requireAuth,
    async (req, res) => {
      const userId = req.session.userId!;
      const externalCampaignId = getParam(req, "externalCampaignId");
      if (!externalCampaignId) return res.status(400).json({ message: "缺少 externalCampaignId" });
      const payload = await buildAttributionDebugForCampaign(userId, externalCampaignId);
      res.json(payload);
    }
  );

  app.post("/api/creative-reviews/from-asset-version", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const assetVersionId = String(req.body?.assetVersionId ?? "").trim();
    const reviewSource = String(req.body?.reviewSource ?? "manual_judgment").trim() || "manual_judgment";
    if (!assetVersionId) return res.status(400).json({ message: "assetVersionId 必填" });
    const settings = storage.getSettings(userId);
    const apiKey = settings.aiApiKey?.trim();
    if (!apiKey) return res.status(400).json({ message: "請先設定 AI API Key", errorCode: "NO_API_KEY" });

    const result = await runCreativeReviewFromAssetVersion({
      userId,
      apiKey,
      assetVersionId,
      reviewSource,
    });
    if (!result.ok) {
      const code = result.code === "NOT_FOUND" ? 404 : result.code === "AI_CALL_FAILED" ? 502 : 400;
      return res.status(code).json({ message: result.message, errorCode: result.code });
    }
    res.status(201).json({ reviewId: result.reviewId });
  });

  /** 6.5：非同步佇列送審（避免 UI 長時間卡在同步 request） */
  app.post("/api/creative-reviews/queue", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const assetVersionId = String(req.body?.assetVersionId ?? "").trim();
    const reviewSource = String(req.body?.reviewSource ?? "manual_judgment").trim() || "manual_judgment";
    if (!assetVersionId) return res.status(400).json({ message: "assetVersionId 必填" });
    const active = await findActiveCreativeReviewJob(userId, assetVersionId);
    if (active) {
      return res.status(202).json({ jobId: active.id, status: active.status, reused: true });
    }
    const job = await createCreativeReviewJob({ userId, assetVersionId, reviewSource });
    return res.status(202).json({ jobId: job.id, status: job.status, reused: false });
  });

  app.post("/api/creative-reviews/queue-batch", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const out: { assetVersionId: string; jobId: string; status: string; reused: boolean }[] = [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const assetVersionId = String((raw as { assetVersionId?: unknown }).assetVersionId ?? "").trim();
      if (!assetVersionId) continue;
      const reviewSource =
        String((raw as { reviewSource?: unknown }).reviewSource ?? "batch_queue").trim() || "batch_queue";
      const active = await findActiveCreativeReviewJob(userId, assetVersionId);
      if (active) {
        out.push({ assetVersionId, jobId: active.id, status: active.status, reused: true });
        continue;
      }
      const job = await createCreativeReviewJob({ userId, assetVersionId, reviewSource });
      out.push({ assetVersionId, jobId: job.id, status: job.status, reused: false });
    }
    return res.status(202).json({ jobs: out, count: out.length });
  });

  app.post("/api/creative-reviews/queue-by-package", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const packageId = String(req.body?.packageId ?? "").trim();
    if (!packageId) return res.status(400).json({ message: "packageId 必填" });
    const versions = assetVersionService.listByPackage(userId, packageId);
    if (versions.length === 0) {
      return res.status(404).json({ message: "找不到版本或套件為空" });
    }
    const out: { assetVersionId: string; jobId: string; status: string; reused: boolean }[] = [];
    for (const v of versions) {
      const assetVersionId = v.id;
      const active = await findActiveCreativeReviewJob(userId, assetVersionId);
      if (active) {
        out.push({ assetVersionId, jobId: active.id, status: active.status, reused: true });
        continue;
      }
      const job = await createCreativeReviewJob({
        userId,
        assetVersionId,
        reviewSource: "package_batch_enqueue",
      });
      out.push({ assetVersionId, jobId: job.id, status: job.status, reused: false });
    }
    return res.status(202).json({ packageId, jobs: out, count: out.length });
  });

  app.get("/api/creative-reviews/jobs/:jobId", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const jobId = getParam(req, "jobId");
    if (!jobId) return res.status(400).json({ message: "缺少 jobId" });
    const job = await getCreativeReviewJob(userId, jobId);
    if (!job) return res.status(404).json({ message: "找不到 job" });
    res.json({ job: serializeCreativeReviewJob(job) });
  });

  app.get("/api/creative-reviews/by-version/:assetVersionId", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const assetVersionId = getParam(req, "assetVersionId");
    if (!assetVersionId) return res.status(400).json({ message: "缺少 assetVersionId" });
    const review = await findLatestReviewForVersion(userId, assetVersionId);
    if (!review) return res.json({ review: null, tags: [] });
    const tags = await listTagsForReviewIds([review.id]);
    res.json({ review, tags });
  });

  app.get("/api/creative-intelligence/patterns", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    try {
      if (req.query.syncSnapshots === "1") {
        const batch = getBatchFromRequest(req);
        const cm = batch?.campaignMetrics ?? [];
        if (cm.length > 0) {
          try {
            await syncOutcomeSnapshotsFromBatch({
              userId,
              campaignMetrics: cm.map((c) => ({
                campaignId: c.campaignId,
                spend: c.spend,
                revenue: c.revenue,
                roas: c.roas,
                clicks: c.clicks,
                conversions: c.conversions,
                addToCart: c.addToCart,
              })),
            });
          } catch (syncErr) {
            console.error("[creative-intelligence/patterns] syncOutcomeSnapshotsFromBatch failed:", syncErr);
          }
        }
      }
      const payload = await buildCreativePatternsPayload(userId);
      res.json(payload);
    } catch (err) {
      console.error("[creative-intelligence/patterns] buildCreativePatternsPayload failed:", err);
      const degraded = await buildDegradedCreativePatternsPayload(
        userId,
        err instanceof Error ? err.message : String(err)
      );
      res.status(200).json(degraded);
    }
  });

  app.get("/api/creative-intelligence/version/:assetVersionId", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const assetVersionId = getParam(req, "assetVersionId");
    const review = await findLatestReviewForVersion(userId, assetVersionId);
    const tags = review ? await listTagsForReviewIds([review.id]) : [];
    const snaps = await prisma.creativeOutcomeSnapshot.findMany({
      where: { userId, assetVersionId },
      orderBy: { snapshotDate: "desc" },
      take: 20,
    });
    const links = await prisma.creativeExperimentLink.findMany({
      where: { userId, assetVersionId },
      orderBy: { linkedAt: "desc" },
      take: 30,
    });
    const latestSnap = snaps[0] ?? null;
    const wl = whyWinningWhyLosing(latestSnap);
    const ambSig = computeVersionAmbiguitySignals(links, latestSnap);
    const ambiguityReasons = ambiguityReasonLines(ambSig);
    res.json({
      review,
      tags,
      snapshots: snaps,
      links,
      attribution: {
        snapshotConfidence: confidenceFromSnapshot(latestSnap),
        linkSummary: linkAttributionSummary(links),
        whyWinning: wl.whyWinning,
        whyLosing: wl.whyLosing,
        ambiguitySignals: ambSig,
        ambiguityReasons,
        /** @deprecated 請優先使用 ambiguityReasons */
        ambiguityCopy:
          "若快照 ambiguous=true 或 link 非唯一 primary，請勿將此版本當作高信心 winner／hidden diamond。",
      },
      versionTimeline: buildVersionTimelineEntries(review ? [review] : [], snaps, links),
    });
  });

  app.get(
    "/api/creative-intelligence/product/:productName/pattern-performance",
    requireAuth,
    async (req, res) => {
      const userId = req.session.userId!;
      const productName = decodeURIComponent(getParam(req, "productName") || "");
      if (!productName) return res.status(400).json({ message: "缺少 productName" });
      const summary = await buildProductPatternPerformanceSummary(userId, productName);
      res.json(summary);
    }
  );

  app.get("/api/creative-intelligence/product/:productName", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const productName = decodeURIComponent(getParam(req, "productName") || "");
    if (!productName) return res.status(400).json({ message: "缺少 productName" });
    const reviews = await prisma.creativeReviewRecord.findMany({
      where: { userId, productName },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const ids = reviews.map((r) => r.id);
    const tags = await listTagsForReviewIds(ids);
    const snaps = await prisma.creativeOutcomeSnapshot.findMany({
      where: { userId, productName },
      orderBy: { snapshotDate: "desc" },
      take: 50,
    });
    const amb = snaps.filter((s) => s.ambiguousAttribution).length;
    const clear = snaps.length - amb;
    res.json({
      productName,
      reviews,
      tags,
      snapshots: snaps,
      attributionProduct: {
        snapshotTotal: snaps.length,
        ambiguousCount: amb,
        clearAttributionCount: clear,
        copy:
          amb > 0
            ? `此商品有 ${amb} 筆快照為歧義歸因（多版本競爭或 non-primary link）；模式彙總已自動降權。`
            : "目前快照皆為單一 primary 結構或可歸因狀態（仍請對照樣本量）。",
      },
      /** 7.8：商品層歸因診斷（單版本細節請用 /version/:assetVersionId） */
      attributionProductDiagnostics: {
        ambiguousSnapshotRatio: snaps.length ? amb / snaps.length : 0,
        probeHint:
          "單版本 drilldown：Creative Intelligence workbench 之「版本歸因探測」，或 GET /api/creative-intelligence/version/:assetVersionId。",
        linkSemantics:
          "linkLifecycleState=active 且 isPrimary 之連結優先承載 campaign 歸因；soft_inactive／superseded 與同一 campaign 並存時，後續快照應標 ambiguous。",
      },
    });
  });
}
