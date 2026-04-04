import type { Express, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { buildScopeKey, type RefreshJob } from "@shared/schema";
import { storage } from "../storage";
import { runRefreshJob } from "../refresh-job-runner";
import { syncRouter } from "../modules/sync/sync-routes";

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

function getParam(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

export function registerSyncRefreshRoutes(app: Express, requireAuth: RequireAuth): void {
  app.use("/api/sync", requireAuth, syncRouter);

  app.post("/api/refresh", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const datePreset = (req.body.datePreset as string) || "7";
    const customStart = req.body.customStart as string | undefined;
    const customEnd = req.body.customEnd as string | undefined;
    const selectedAccountIds: string[] = req.body.selectedAccountIds || [];
    const selectedPropertyIds: string[] = req.body.selectedPropertyIds || [];

    const scopeKey = buildScopeKey(
      userId,
      selectedAccountIds,
      selectedPropertyIds,
      datePreset,
      datePreset === "custom" ? customStart : undefined,
      datePreset === "custom" ? customEnd : undefined
    );
    const existing = storage.getRunningJobByScopeKey(scopeKey);
    if (existing) {
      return res.json({
        jobId: existing.jobId,
        status: existing.status,
        scopeKey,
        message: "????????????????? jobId ????",
      });
    }

    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const job: RefreshJob = {
      jobId,
      userId,
      scopeKey,
      lockKey: scopeKey,
      status: "pending",
      createdAt,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      errorStage: null,
      resultBatchKey: null,
      attemptCount: 1,
      triggerSource: "manual_refresh",
      progressStep: null,
      progressMessage: null,
      datePreset,
      customStart,
      customEnd,
      selectedAccountIds,
      selectedPropertyIds,
    };
    await storage.createRefreshJob(job);
    storage.setRefreshStatus(userId, { isRefreshing: true, currentStep: "?????...", progress: 5 });

    res.json({ jobId, status: job.status, scopeKey });

    void runRefreshJob(jobId).catch((err) => {
      console.error("[Refresh] runRefreshJob error:", err);
    });
  });

  app.get("/api/refresh/status", requireAuth, (req, res) => {
    const status = storage.getRefreshStatus(req.session.userId!);
    res.json(status);
  });

  app.get("/api/refresh/:jobId/status", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const jobId = getParam(req, "jobId");
    const job = storage.getRefreshJob(jobId);
    if (!job || job.userId !== userId) {
      return res.status(404).json({ error: "job not found" });
    }
    res.json({
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      errorStage: job.errorStage,
      errorMessage: job.errorMessage,
      resultBatchKey: job.resultBatchKey,
      progressStep: job.progressStep,
      progressMessage: job.progressMessage,
      scopeKey: job.scopeKey,
    });
  });
}
