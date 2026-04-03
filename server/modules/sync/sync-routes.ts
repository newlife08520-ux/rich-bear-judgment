import { Router, type Request, type Response } from "express";
import { computeOutOfBandHints } from "./out-of-band-hints";
import { resetAdjustCountsForUserToday } from "../creative-intelligence/workbench-adjust-prisma";

export const syncRouter = Router();

/** GET：out-of-band 漂移提示（需有效 FB token） */
syncRouter.get("/out-of-band-hints", async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "未登入" });
  try {
    const out = await computeOutOfBandHints(userId);
    return res.status(200).json({
      hints: out.hints,
      tokenMissing: out.tokenMissing,
      graphError: out.graphError,
    });
  } catch (e) {
    return res.status(500).json({
      message: e instanceof Error ? e.message : "out-of-band 檢查失敗",
    });
  }
});

/** POST：確認已讀外部變更 — 重置今日 adjust 計數（節奏校準） */
syncRouter.post("/acknowledge-external-drift", async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "未登入" });
  try {
    const n = await resetAdjustCountsForUserToday(userId);
    return res.status(200).json({ ok: true, resetRows: n });
  } catch (e) {
    return res.status(500).json({
      message: e instanceof Error ? e.message : "校準失敗",
    });
  }
});
