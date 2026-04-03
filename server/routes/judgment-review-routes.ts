/**
 * Batch 14.6：審判／review session 讀取路由自 routes.ts 抽出（行為不變）。
 */
import type { Express, RequestHandler } from "express";
import { storage } from "../storage";

export function registerJudgmentReviewRoutes(app: Express, requireAuth: RequestHandler): void {
  app.get("/api/review-sessions", requireAuth, (req, res) => {
    const list = storage.getReviewSessions(req.session.userId!);
    res.json(list);
  });

  app.get("/api/review-sessions/:id", requireAuth, (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = storage.getReviewSession(id);
    if (!session) return res.status(404).json({ message: "找不到該工作階段" });
    if (session.userId !== req.session.userId) return res.status(403).json({ message: "無權存取" });
    res.json(session);
  });

  app.get("/api/judgment/history", requireAuth, (req, res) => {
    const records = storage.getJudgmentHistory(req.session.userId!);
    const typeFilter = req.query.type as string | undefined;
    if (typeFilter) {
      res.json(records.filter((r) => r.type === typeFilter));
    } else {
      res.json(records);
    }
  });

  app.get("/api/judgment/:id", requireAuth, (req, res) => {
    const report = storage.getJudgmentReport(req.params.id as string);
    if (!report) {
      return res.status(404).json({ message: "?????????" });
    }
    res.json(report);
  });
}
