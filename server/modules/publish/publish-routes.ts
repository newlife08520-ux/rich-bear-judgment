import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import type { PublishTemplate } from "@shared/schema";
import * as publishService from "./publish-service";
import * as templateRepo from "./publish-template-repository";

/**
 * Publish 模組 API 回傳格式（與 asset 模組一致）：
 * - 成功：直接回傳資料本體（PublishDraft | PublishDraft[] | PublishLog[]），不包在額外欄位內。
 * - 失敗：{ message: string, errors?: unknown }，errors 僅在驗證失敗時存在。
 */
export const publishRouter = Router();

function getUserId(req: Request): string {
  const id = (req as Request & { session: { userId?: string } }).session?.userId;
  if (!id) {
    throw new Error("UNAUTHORIZED");
  }
  return id;
}

function getParamId(req: Request, key: string): string {
  const p = req.params[key];
  return Array.isArray(p) ? p[0] ?? "" : p ?? "";
}

/** GET /api/publish/drafts - 列出當前使用者的投放草稿 */
publishRouter.get("/drafts", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const list = await publishService.listDrafts(userId);
    res.json(list);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** POST /api/publish/drafts - 建立投放草稿 */
publishRouter.post("/drafts", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const result = await publishService.createDraft(userId, req.body);
    if (!result.ok) {
      const status = result.notFound ? 404 : 400;
      const body: { message: string; errors?: unknown } = { message: result.message };
      if (status === 400 && result.errors) body.errors = result.errors;
      return res.status(status).json(body);
    }
    const body = result.warnings?.length ? { ...result.data, warnings: result.warnings } : result.data;
    res.status(201).json(body);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** POST /api/publish/drafts/batch - 批次建立投放草稿（同一 batchId，供一鍵撤回整批） */
publishRouter.post("/drafts/batch", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { batchId, drafts } = req.body as { batchId?: string; drafts?: unknown[] };
    const result = await publishService.createDraftBatch(userId, { batchId: batchId ?? "", drafts: drafts ?? [] });
    if (!result.ok) {
      const status = result.notFound ? 404 : 400;
      const body: { message: string; errors?: unknown } = { message: result.message };
      if (status === 400 && result.errors) body.errors = result.errors;
      return res.status(status).json(body);
    }
    const body = result.warnings?.length ? { ...result.data, warnings: result.warnings } : result.data;
    res.status(201).json(body);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** GET /api/publish/logs - 列出當前使用者的投放紀錄（須在 /drafts/:id 之前定義，避免 "logs" 被當成 :id） */
publishRouter.get("/logs", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const list = await publishService.listLogs(userId);
    res.json(list);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** GET /api/publish/templates - 列出當前使用者的投放範本 */
publishRouter.get("/templates", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const list = templateRepo.listByUserId(userId);
    res.json(list);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** POST /api/publish/templates - 建立投放範本 */
publishRouter.post("/templates", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const body = req.body as Record<string, unknown>;
    const id = randomUUID();
    const now = new Date().toISOString();
    const audienceStrategy = ["broad", "remarketing", "custom"].includes(body.audienceStrategy as string)
      ? (body.audienceStrategy as "broad" | "remarketing" | "custom")
      : "broad";
    const placementStrategy = ["auto", "feeds_only", "reels_stories"].includes(body.placementStrategy as string)
      ? (body.placementStrategy as "auto" | "feeds_only" | "reels_stories")
      : "auto";
    const template = {
      id,
      userId,
      name: (body.name as string) || "未命名範本",
      accountId: body.accountId as string | undefined,
      pageId: body.pageId as string | undefined,
      igAccountId: body.igAccountId as string | undefined,
      budgetDaily: body.budgetDaily as number | undefined,
      budgetTotal: body.budgetTotal as number | undefined,
      audienceStrategy,
      placementStrategy,
      cta: body.cta as string | undefined,
      landingPageUrl: body.landingPageUrl as string | undefined,
      campaignNameTemplate: body.campaignNameTemplate as string | undefined,
      adSetNameTemplate: body.adSetNameTemplate as string | undefined,
      adNameTemplate: body.adNameTemplate as string | undefined,
      createdAt: now,
    };
    templateRepo.create(userId, template as PublishTemplate);
    res.status(201).json(template);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** DELETE /api/publish/templates/:id - 刪除投放範本 */
publishRouter.delete("/templates/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const ok = templateRepo.remove(userId, id);
    if (!ok) return res.status(404).json({ message: "找不到該範本" });
    res.status(204).send();
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** GET /api/publish/drafts/:id - 取得單一投放草稿 */
publishRouter.get("/drafts/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const draft = await publishService.getDraft(userId, id);
    if (!draft) {
      return res.status(404).json({ message: "找不到該投放草稿" });
    }
    res.json(draft);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** PUT /api/publish/drafts/:id - 更新投放草稿 */
publishRouter.put("/drafts/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const result = await publishService.updateDraft(userId, id, req.body);
    if (!result.ok) {
      const status = result.notFound ? 404 : 400;
      const body: { message: string; errors?: unknown } = { message: result.message };
      if (status === 400 && result.errors) body.errors = result.errors;
      return res.status(status).json(body);
    }
    res.json(result.data);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});
