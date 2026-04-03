import type { Express } from "express";
import { checkFfprobeAvailable } from "../modules/asset/ffprobe-health";
import { getPrecomputeStats } from "../precompute-metrics";

/** Batch 12.7 plan-A：自 routes.ts 抽出之輕量 health／debug 註冊 */
export function registerHealthAndDebugRoutes(app: Express): void {
  app.get("/api/health/ffprobe", (_req, res) => {
    const result = checkFfprobeAvailable();
    res.status(result.ok ? 200 : 503).json(result);
  });

  app.get("/api/debug/precompute-stats", (req, res) => {
    const devOnly = process.env.NODE_ENV === "development";
    const explicitlyEnabled =
      process.env.ENABLE_DEBUG_PRECOMPUTE_STATS === "1" || process.env.ENABLE_DEBUG_PRECOMPUTE_STATS === "true";
    if (!devOnly && !explicitlyEnabled) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(getPrecomputeStats());
  });
}
