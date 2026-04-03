import { Router, type Request, type Response } from "express";
import { runDryRun, runApply, appendRollbackNote } from "./execution-service";
import { readExecutionRuns } from "./execution-repository";

export const executionRouter = Router();

executionRouter.post("/dry-run", async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "未登入" });
  }
  const body = req.body ?? {};
  try {
    const out = await runDryRun(userId, {
      actionType: body.actionType,
      payload: body.payload,
    });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({
      message: e instanceof Error ? e.message : "dry-run 失敗",
    });
  }
});

executionRouter.post("/apply", async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "未登入" });
  }
  const body = req.body ?? {};
  const out = await runApply(userId, {
    dryRunId: body.dryRunId,
    approved: body.approved === true,
  });
  if (!out.ok) {
    return res.status(400).json(out);
  }
  return res.status(200).json(out);
});

executionRouter.post("/rollback-note", async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "未登入" });
  }
  const note = typeof req.body?.note === "string" ? req.body.note : "";
  const dryRunId = typeof req.body?.dryRunId === "string" ? req.body.dryRunId : "";
  const out = await appendRollbackNote(userId, dryRunId, note);
  if (!out.ok) {
    return res.status(400).json(out);
  }
  return res.status(200).json(out);
});

executionRouter.get("/logs", async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "未登入" });
  }
  const limit = Math.min(
    200,
    Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50)
  );
  const logs = await readExecutionRuns(userId, limit);
  return res.status(200).json({ logs });
});
