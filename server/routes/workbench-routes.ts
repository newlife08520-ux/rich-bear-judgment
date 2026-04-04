/**
 * Workbench API：decision-cards、owners、tasks、audit、coverage、mapping、thresholds、prompts、calibration
 * 由 routes.ts composition 掛載，path 與行為與原內聯一致。
 */
import type { Express, Request, RequestHandler, Response } from "express";
import * as path from "path";
import { storage } from "../storage";
import { prisma } from "../db";
import { getBuildVersion } from "../version";
import type { AnalysisBatch, CampaignMetrics } from "@shared/schema";
import {
  aggregateByProductWithResolver,
  aggregateByCreativeTagsWithResolver,
  parseCampaignNameToTags,
  getHistoricalFailureRateByTag,
} from "@shared/tag-aggregation-engine";
import { stitchFunnelData, runFunnelDiagnostics } from "@shared/funnel-stitching";
import { buildDecisionCards, type CreativeLeaderboardRow } from "@shared/decision-cards-engine";
import { buildGoalPacingByProduct } from "../modules/goal-pacing/build-product-pacing";
import { CALIBRATION_MODULE_NAMES } from "../rich-bear-calibration";
import { validateOverlayContent } from "../prompt-overlay-validation";
import {
  getWorkbenchOwners,
  patchWorkbenchProductOwner,
  getWorkbenchTasks,
  createWorkbenchTask,
  createWorkbenchTasksBatch,
  updateWorkbenchTask,
  batchUpdateWorkbenchTasks,
  getWorkbenchTask,
  getWorkbenchAuditLog,
  getWorkbenchMappingOverrides,
  setWorkbenchMappingOverride,
  getWorkbenchMappingRecord,
  resolveProductWithOverrides,
  getPublishedThresholdConfig,
  getDraftThresholdConfig,
  saveDraftThresholdConfig,
  publishThreshold,
  rollbackThreshold,
  getPublishedPrompt,
  getPublishedPromptWithMeta,
  getDraftPrompt,
  getDraftPromptWithStructured,
  saveDraftPrompt,
  publishPrompt,
  rollbackPrompt,
} from "../workbench-db";

function getParam(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

function getBatchFromRequest(req: Request): AnalysisBatch | null {
  const userId = req.session.userId!;
  const scopeKey = (req.query.scope as string) || undefined;
  return storage.getLatestBatch(userId, scopeKey);
}

export function registerWorkbenchRoutes(app: Express, requireAuth: RequestHandler): void {
  app.post("/api/workbench/tasks/batch", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as { items: Array<{ title: string; action: string; reason: string; productName?: string }> };
    if (!Array.isArray(body?.items) || body.items.length === 0) {
      return res.status(400).json({ message: "items 必填且為陣列" });
    }
    const toCreate = body.items.filter((it) => it.title && it.action && it.reason).map((it) => ({
      productName: it.productName,
      title: it.title,
      action: it.action,
      reason: it.reason,
      assigneeId: null as string | null,
      status: "unassigned" as const,
      createdBy: userId,
      notes: "",
    }));
    const created = await createWorkbenchTasksBatch(toCreate);
    res.status(201).json({ created, count: created.length });
  });

  app.get("/api/workbench/decision-cards", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const scopeAccountIds = typeof req.query.scopeAccountIds === "string"
      ? req.query.scopeAccountIds.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const scopeProducts = typeof req.query.scopeProducts === "string"
      ? req.query.scopeProducts.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const useOverrides = req.query.useOverrides !== "false";

    if (!batch || !batch.campaignMetrics || batch.campaignMetrics.length === 0) {
      return res.json({ cards: [] });
    }

    const normalizeAccountId = (id: string) => (id || "").replace(/^act_/, "");
    const accountIdSet =
      scopeAccountIds && scopeAccountIds.length > 0
        ? new Set(scopeAccountIds.map(normalizeAccountId))
        : null;

    let rows = batch.campaignMetrics.map((c: CampaignMetrics) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      frequency: c.frequency,
      roasPrev: c.roasPrev,
      biddingType: c.biddingType,
      targetOutcomeValue: c.targetOutcomeValue,
      spendFullness: c.spendFullness,
      todayAdjustCount: c.todayAdjustCount,
      observationWindowUntil: c.observationWindowUntil,
      lastAdjustType: c.lastAdjustType,
    }));

    if (accountIdSet && accountIdSet.size > 0) {
      rows = rows.filter((r: { accountId: string }) => accountIdSet.has(normalizeAccountId(r.accountId)));
    }

    const overrides = useOverrides ? await getWorkbenchMappingOverrides() : new Map<string, string>();
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(
        row,
        overrides,
        (name) => parseCampaignNameToTags(name)?.productName ?? null
      );

    const productLevel = aggregateByProductWithResolver(rows, resolveProduct, scopeProducts);
    const creativeRaw = aggregateByCreativeTagsWithResolver(rows, resolveProduct, scopeProducts);
    const creativeLeaderboard: CreativeLeaderboardRow[] = creativeRaw.map((c) => ({
      productName: c.productName,
      materialStrategy: c.materialStrategy,
      headlineSnippet: c.headlineSnippet,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      conversions: c.conversions,
      campaignCount: c.campaignCount,
    }));
    const failureRatesByTag = getHistoricalFailureRateByTag(rows);

    const urgentStop = rows.filter(
      (r: { spend: number; conversions: number }) => r.spend >= 500 && r.conversions === 0
    ).map((r: { campaignId: string; campaignName: string; accountId: string; spend: number }) => ({
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      accountId: r.accountId,
      spend: r.spend,
      message: "高花費零轉化，建議先停",
    }));

    const ga4Rows: Array<{ productName: string; sessions: number; bounceRate: number; addToCart: number; purchases: number }> = [];
    const fbRows = productLevel.map((p) => ({
      productName: p.productName,
      spend: p.spend,
      revenue: p.revenue,
      roas: p.roas,
      impressions: p.impressions,
      clicks: p.clicks,
      conversions: p.conversions,
    }));
    const funnelRows = stitchFunnelData(fbRows, ga4Rows);
    const funnelEvidence = false;
    const funnelWarnings = runFunnelDiagnostics(funnelRows, { funnelEvidence });

    const thresholdConfig = await getPublishedThresholdConfig();
    const cards = buildDecisionCards(
      {
        productLevel,
        creativeLeaderboard,
        funnelWarnings: funnelWarnings || [],
        urgentStop,
        failureRatesByTag,
        analysisWindowLabel: batch.dateRange?.label,
      },
      thresholdConfig as import("@shared/decision-cards-engine").ThresholdConfig | null
    );
    const userId = req.session.userId!;
    const goalPacingByProduct = await buildGoalPacingByProduct(userId, productLevel, rows);
    res.json({ cards, goalPacingByProduct });
  });

  app.get("/api/workbench/goal-pacing", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const userId = req.session.userId!;
    const scopeAccountIds = typeof req.query.scopeAccountIds === "string"
      ? req.query.scopeAccountIds.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const scopeProducts = typeof req.query.scopeProducts === "string"
      ? req.query.scopeProducts.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const useOverrides = req.query.useOverrides !== "false";
    if (!batch || !batch.campaignMetrics?.length) {
      return res.json({ goalPacingByProduct: {} });
    }
    const normalizeAccountId = (id: string) => (id || "").replace(/^act_/, "");
    const accountIdSet =
      scopeAccountIds && scopeAccountIds.length > 0
        ? new Set(scopeAccountIds.map(normalizeAccountId))
        : null;
    let rows = batch.campaignMetrics.map((c: CampaignMetrics) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      frequency: c.frequency,
      roasPrev: c.roasPrev,
      biddingType: c.biddingType,
      targetOutcomeValue: c.targetOutcomeValue,
      spendFullness: c.spendFullness,
      todayAdjustCount: c.todayAdjustCount,
      observationWindowUntil: c.observationWindowUntil,
      lastAdjustType: c.lastAdjustType,
    }));
    if (accountIdSet && accountIdSet.size > 0) {
      rows = rows.filter((r) => accountIdSet!.has(normalizeAccountId(r.accountId)));
    }
    const overrides = useOverrides ? await getWorkbenchMappingOverrides() : new Map<string, string>();
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);
    const productLevel = aggregateByProductWithResolver(rows, resolveProduct, scopeProducts);
    const goalPacingByProduct = await buildGoalPacingByProduct(userId, productLevel, rows);
    res.json({ goalPacingByProduct });
  });

  /** 7.5：整併商品節奏診斷（含 ingestionGaps / operatorPacingState 聚合） */
  app.get("/api/workbench/goal-pacing-diagnostics", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const userId = req.session.userId!;
    const scopeAccountIds =
      typeof req.query.scopeAccountIds === "string"
        ? req.query.scopeAccountIds.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const scopeProducts =
      typeof req.query.scopeProducts === "string"
        ? req.query.scopeProducts.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const useOverrides = req.query.useOverrides !== "false";
    if (!batch || !batch.campaignMetrics?.length) {
      return res.json({ goalPacingByProduct: {}, summary: { productCount: 0, operatorStateHistogram: {}, withIngestionGaps: 0 } });
    }
    const normalizeAccountId = (id: string) => (id || "").replace(/^act_/, "");
    const accountIdSet =
      scopeAccountIds && scopeAccountIds.length > 0
        ? new Set(scopeAccountIds.map(normalizeAccountId))
        : null;
    let rows = batch.campaignMetrics.map((c: CampaignMetrics) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      frequency: c.frequency,
      roasPrev: c.roasPrev,
      biddingType: c.biddingType,
      targetOutcomeValue: c.targetOutcomeValue,
      spendFullness: c.spendFullness,
      todayAdjustCount: c.todayAdjustCount,
      observationWindowUntil: c.observationWindowUntil,
      lastAdjustType: c.lastAdjustType,
    }));
    if (accountIdSet && accountIdSet.size > 0) {
      rows = rows.filter((r) => accountIdSet!.has(normalizeAccountId(r.accountId)));
    }
    const overrides = useOverrides ? await getWorkbenchMappingOverrides() : new Map<string, string>();
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);
    const productLevel = aggregateByProductWithResolver(rows, resolveProduct, scopeProducts);
    const goalPacingByProduct = await buildGoalPacingByProduct(userId, productLevel, rows);
    const hist: Record<string, number> = {};
    let withIngestionGaps = 0;
    for (const ev of Object.values(goalPacingByProduct)) {
      const st = ev.operatorPacingState ?? "unknown";
      hist[st] = (hist[st] ?? 0) + 1;
      if ((ev.ingestionGaps?.length ?? 0) > 0) withIngestionGaps += 1;
    }
    res.json({
      goalPacingByProduct,
      summary: {
        productCount: Object.keys(goalPacingByProduct).length,
        operatorStateHistogram: hist,
        withIngestionGaps,
      },
    });
  });

  app.post("/api/workbench/adjust-ledger/increment", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const entityKey = String(req.body?.entityKey ?? "").trim();
    const adjustType = String(req.body?.adjustType ?? "other").trim() || "other";
    const observationHours = typeof req.body?.observationHours === "number" ? req.body.observationHours : 3;
    if (!entityKey) return res.status(400).json({ message: "entityKey 必填" });
    const { incrementAdjust } = await import("../modules/creative-intelligence/workbench-adjust-prisma");
    const row = await incrementAdjust({ userId, entityKey, adjustType, observationHours });
    res.json({
      ok: true,
      adjustCount: row.adjustCount,
      observationWindowUntil: row.observationWindowUntil?.toISOString() ?? null,
      lastAdjustType: row.lastAdjustType,
    });
  });

  app.get("/api/workbench/owners", requireAuth, async (_req, res) => {
    const data = await getWorkbenchOwners();
    res.json(data);
  });

  app.patch("/api/workbench/owners/:productName", requireAuth, async (req, res) => {
    const productName = decodeURIComponent(getParam(req, "productName") || "");
    if (!productName) return res.status(400).json({ message: "請提供 productName" });
    const userId = req.session.userId!;
    const body = req.body as { productOwnerId?: string; mediaOwnerId?: string; creativeOwnerId?: string; taskStatus?: string };
    const owners = await getWorkbenchOwners();
    const old = owners[productName];
    await patchWorkbenchProductOwner(productName, {
      productOwnerId: body.productOwnerId !== undefined ? body.productOwnerId : old?.productOwnerId ?? "",
      mediaOwnerId: body.mediaOwnerId !== undefined ? body.mediaOwnerId : old?.mediaOwnerId ?? "",
      creativeOwnerId: body.creativeOwnerId !== undefined ? body.creativeOwnerId : old?.creativeOwnerId ?? "",
      taskStatus: body.taskStatus !== undefined ? (body.taskStatus as "unassigned" | "assigned" | "in_progress" | "done" | "pending_confirm") : old?.taskStatus ?? "unassigned",
    }, userId);
    const next = (await getWorkbenchOwners())[productName];
    res.json(next);
  });

  app.get("/api/workbench/tasks", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const onlyMine = req.query.onlyMine === "1" || req.query.onlyMine === "true";
      const tasks = await getWorkbenchTasks(onlyMine ? { assigneeId: userId } : undefined);
      res.json(tasks);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const full = err instanceof Error ? err.stack : String(err);
      console.error("[GET /api/workbench/tasks] full error:", full);
      const prismaErrorCode = (err as { code?: string })?.code;
      const prismaErrorMessage = msg;
      const isSchemaOrColumnError =
        /column|no such column|Unknown column|SQLITE_ERROR|P3009|P2010|does not exist/i.test(msg);

      const buildVersion = getBuildVersion();
      let debug: { buildVersion: { commit: string; branch: string; timestamp: string }; dbPath: string; tableExists: boolean | null; missingColumns: string[] | null; prismaErrorCode?: string; prismaErrorMessage: string } = {
        buildVersion,
        dbPath: "",
        tableExists: null,
        missingColumns: null,
        prismaErrorCode,
        prismaErrorMessage,
      };
      try {
        const dbFile = process.env.DATABASE_URL?.replace(/^file:/, "") ?? path.join(process.cwd(), ".data", "workbench.db");
        debug.dbPath = path.isAbsolute(dbFile) ? dbFile : path.resolve(process.cwd(), dbFile);
        const tableRows = await prisma.$queryRawUnsafe<{ name: string }[]>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='WorkbenchTask'"
        );
        debug.tableExists = tableRows.length > 0;
        const requiredNewColumns = ["draftId", "reviewSessionId", "taskSource", "priority", "dueDate", "impactAmount", "taskType"];
        if (debug.tableExists) {
          const infoRows = await prisma.$queryRawUnsafe<{ name: string }[]>("PRAGMA table_info('WorkbenchTask')");
          const currentNames = infoRows.map((r) => r.name);
          debug.missingColumns = requiredNewColumns.filter((c) => !currentNames.includes(c));
        }
      } catch (e) {
        debug.prismaErrorMessage = [msg, (e instanceof Error ? e.message : String(e))].join("; debug gather failed: ");
      }

      if (isSchemaOrColumnError) {
        console.error("[GET /api/workbench/tasks] schema/column error ??503. debug:", JSON.stringify(debug));
        return res.status(503).json({
          message: "任務列表暫時異常，請稍後再試或聯繫管理員",
          errorCode: "TASKS_DEGRADED",
          buildVersion,
          debug,
        });
      }
      res.status(500).json({ message: "伺服器錯誤", error: msg, buildVersion, debug });
    }
  });

  app.patch("/api/workbench/tasks/batch", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as { ids: string[]; status?: string; assigneeId?: string | null };
    if (!Array.isArray(body?.ids) || body.ids.length === 0) {
      return res.status(400).json({ message: "ids 必填且為陣列" });
    }
    const result = await batchUpdateWorkbenchTasks(
      body.ids,
      {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId }),
      },
      userId
    );
    res.json(result);
  });

  app.post("/api/workbench/tasks", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as {
      productName?: string; creativeId?: string; draftId?: string | null; reviewSessionId?: string | null; title: string; action: string; reason: string;
      assigneeId?: string | null; status?: string; notes?: string;
      taskSource?: string | null; priority?: string | null; dueDate?: string | null; impactAmount?: string | null; taskType?: string | null;
    };
    if (!body.title || !body.action || !body.reason) {
      return res.status(400).json({ message: "??? title / action / reason" });
    }
    const task = await createWorkbenchTask({
      productName: body.productName,
      creativeId: body.creativeId,
      draftId: body.draftId ?? undefined,
      reviewSessionId: body.reviewSessionId ?? undefined,
      title: body.title,
      action: body.action,
      reason: body.reason,
      assigneeId: body.assigneeId ?? null,
      status: (body.status as "unassigned" | "assigned" | "in_progress" | "done" | "pending_confirm") || "unassigned",
      createdBy: userId,
      notes: body.notes ?? "",
      taskSource: body.taskSource ?? undefined,
      priority: body.priority ?? undefined,
      dueDate: body.dueDate ?? undefined,
      impactAmount: body.impactAmount ?? undefined,
      taskType: body.taskType ?? undefined,
    });
    res.status(201).json(task);
  });

  app.patch("/api/workbench/tasks/:id", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const id = getParam(req, "id");
    const body = req.body as {
      assigneeId?: string | null; status?: string; notes?: string; updatedAt?: string | null;
      priority?: string | null; dueDate?: string | null; impactAmount?: string | null; taskType?: string | null; taskSource?: string | null;
    };
    const old = await getWorkbenchTask(id);
    if (!old) return res.status(404).json({ message: "找不到該任務" });
    const result = await updateWorkbenchTask(
      id,
      {
        assigneeId: body.assigneeId !== undefined ? body.assigneeId : undefined,
        status: body.status as "unassigned" | "assigned" | "in_progress" | "done" | "pending_confirm" | undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        priority: body.priority !== undefined ? body.priority : undefined,
        dueDate: body.dueDate !== undefined ? body.dueDate : undefined,
        impactAmount: body.impactAmount !== undefined ? body.impactAmount : undefined,
        taskType: body.taskType !== undefined ? body.taskType : undefined,
        taskSource: body.taskSource !== undefined ? body.taskSource : undefined,
      },
      userId,
      typeof body.updatedAt === "string" ? body.updatedAt : undefined
    );
    if (result && "conflict" in result && result.conflict)
      return res.status(409).json({ message: "版本衝突，請重新整理後再試", code: "CONFLICT" });
    if (!result) return res.status(404).json({ message: "找不到該任務" });
    res.json(result);
  });

  app.get("/api/workbench/audit", requireAuth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const log = await getWorkbenchAuditLog(limit);
    res.json(log);
  });

  app.get("/api/workbench/coverage-check", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const overrides = await getWorkbenchMappingOverrides();
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);
    const productsWithSpend = new Set<string>();
    if (batch?.campaignMetrics?.length) {
      for (const c of batch.campaignMetrics as CampaignMetrics[]) {
        const productName = resolveProduct({ campaignId: c.campaignId, campaignName: c.campaignName });
        if (productName) productsWithSpend.add(productName);
      }
    }
    const owners = await getWorkbenchOwners();
    const missingPrimary: string[] = [];
    const missingBackup: string[] = [];
    const primaryCount = new Map<string, number>();
    const OVERLOAD_THRESHOLD = 6;
    for (const productName of productsWithSpend) {
      const o = owners[productName];
      const primary = o?.productOwnerId?.trim() || "";
      const backup = (o?.mediaOwnerId?.trim() || "") || (o?.creativeOwnerId?.trim() || "");
      if (!primary) missingPrimary.push(productName);
      else {
        primaryCount.set(primary, (primaryCount.get(primary) || 0) + 1);
      }
      if (primary && !backup) missingBackup.push(productName);
    }
    const overload = Array.from(primaryCount.entries())
      .filter(([, count]) => count > OVERLOAD_THRESHOLD)
      .map(([uid, asPrimaryCount]) => ({ userId: uid, asPrimaryCount, limit: OVERLOAD_THRESHOLD }));
    res.json({
      productsWithSpend: Array.from(productsWithSpend),
      missingPrimary,
      missingBackup,
      overload,
    });
  });

  app.get("/api/workbench/mapping/context", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const overrides = await getWorkbenchMappingOverrides();
    if (!batch?.campaignMetrics?.length) {
      return res.json({ unmapped: [], conflicts: [], productNames: [] });
    }
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);
    const rows = (batch.campaignMetrics as CampaignMetrics[]).map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      frequency: c.frequency,
    }));
    const unmapped: Array<{ campaignId: string; campaignName: string }> = [];
    const productNameSet = new Set<string>();
    const creativeToProducts = new Map<string, Set<string>>();
    for (const row of rows) {
      const productName = resolveProduct(row);
      if (productName) productNameSet.add(productName);
      else unmapped.push({ campaignId: row.campaignId, campaignName: row.campaignName });
      const tags = parseCampaignNameToTags(row.campaignName);
      if (tags) {
        const key = `${tags.materialStrategy}\t${tags.headlineSnippet}`;
        if (!creativeToProducts.has(key)) creativeToProducts.set(key, new Set());
        if (productName) creativeToProducts.get(key)!.add(productName);
      }
    }
    const conflicts: Array<{ creativeKey: string; products: string[] }> = [];
    for (const [key, products] of creativeToProducts) {
      if (products.size > 1) {
        const [ms, hs] = key.split("\t");
        conflicts.push({ creativeKey: `${ms} + ${hs}`, products: Array.from(products) });
      }
    }
    res.json({
      unmapped,
      conflicts,
      productNames: Array.from(productNameSet).sort(),
    });
  });

  app.put("/api/workbench/mapping/override", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as { campaignId: string; productName: string };
    if (!body.campaignId) return res.status(400).json({ message: "??? campaignId" });
    await setWorkbenchMappingOverride("campaign", body.campaignId, body.productName || "", userId);
    const record = await getWorkbenchMappingRecord();
    res.json(record);
  });

  app.get("/api/workbench/thresholds/published", requireAuth, async (_req, res) => {
    const config = await getPublishedThresholdConfig();
    res.json(config ?? {});
  });

  app.get("/api/workbench/thresholds/draft", requireAuth, async (_req, res) => {
    const config = await getDraftThresholdConfig();
    res.json(config ?? {});
  });

  app.post("/api/workbench/thresholds/draft", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as Record<string, unknown>;
    await saveDraftThresholdConfig(body, userId);
    const config = await getDraftThresholdConfig();
    res.json(config ?? {});
  });

  app.post("/api/workbench/thresholds/publish", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const ok = await publishThreshold(userId);
    if (!ok) return res.status(400).json({ message: "無 draft 可發佈" });
    const config = await getPublishedThresholdConfig();
    res.json(config ?? {});
  });

  app.post("/api/workbench/thresholds/rollback", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const ok = await rollbackThreshold(userId);
    if (!ok) return res.status(400).json({ message: "至少需保留 2 個版本才能 rollback" });
    const config = await getPublishedThresholdConfig();
    res.json(config ?? {});
  });

  app.get("/api/workbench/prompts/:mode", requireAuth, async (req, res) => {
    const mode = req.params.mode as string;
    const meta = await getPublishedPromptWithMeta(mode);
    const draftRow = await getDraftPromptWithStructured(mode);
    res.json({
      published: meta?.content ?? "",
      publishedSummary: meta?.summary ?? "",
      publishedStructured: meta?.publishedStructured ?? null,
      draft: draftRow.content ?? "",
      draftStructured: draftRow.structuredOverlay ?? null,
      publishedAt: meta?.publishedAt ?? null,
    });
  });

  app.post("/api/workbench/prompts/:mode/draft", requireAuth, async (req, res) => {
    const mode = req.params.mode as string;
    const body = req.body as { content: string; structuredOverlay?: string | null };
    const content = body.content ?? "";
    const structuredOverlay = body.structuredOverlay ?? null;
    const validation = validateOverlayContent(content);
    if (!validation.ok) {
      return res.status(400).json({
        message: validation.reason ?? "內容含禁止的 persona 區塊，請修改後再儲存",
        errorCode: "OVERLAY_PERSONA_BLOCKED",
        matchedLabel: validation.matchedLabel,
      });
    }
    await saveDraftPrompt(mode, content, structuredOverlay);
    const draftRow = await getDraftPromptWithStructured(mode);
    res.json({ draft: draftRow.content ?? "", draftStructured: draftRow.structuredOverlay ?? null });
  });

  app.post("/api/workbench/prompts/:mode/publish", requireAuth, async (req, res) => {
    const mode = req.params.mode as string;
    const draftContent = await getDraftPrompt(mode);
    if (draftContent != null && draftContent.trim()) {
      const validation = validateOverlayContent(draftContent);
      if (!validation.ok) {
        return res.status(400).json({
          message: validation.reason ?? "內容含禁止的 persona 區塊，請修改後再發佈",
          errorCode: "OVERLAY_PERSONA_BLOCKED",
          matchedLabel: validation.matchedLabel,
        });
      }
    }
    const ok = await publishPrompt(mode, req.session.userId ?? undefined);
    if (!ok) return res.status(400).json({ message: "無 draft 可發佈" });
    const published = await getPublishedPrompt(mode);
    res.json({ published: published ?? "" });
  });

  app.post("/api/workbench/prompts/:mode/rollback", requireAuth, async (req, res) => {
    const mode = req.params.mode as string;
    const ok = await rollbackPrompt(mode, req.session.userId ?? undefined);
    if (!ok) return res.status(400).json({ message: "???????" });
    const published = await getPublishedPrompt(mode);
    res.json({ published: published ?? "" });
  });

  app.get("/api/workbench/calibration-modules", requireAuth, (_req, res) => {
    const names = Object.values(CALIBRATION_MODULE_NAMES);
    res.json({ names });
  });
}
