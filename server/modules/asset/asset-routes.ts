import { Router, type Request, type Response } from "express";
import * as assetService from "./asset-service";

/**
 * Asset 模組 API 回傳格式（統一）：
 * - 成功：直接回傳資料本體（Asset | Asset[]），不包在額外欄位內。
 * - 失敗：{ message: string, errors?: unknown }，errors 僅在驗證失敗時存在。
 */
export const assetRouter = Router();

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

/** GET /api/assets - 列出當前使用者的素材 */
assetRouter.get("/", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const list = assetService.list(userId);
    res.json(list);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** POST /api/assets - 建立素材 */
assetRouter.post("/", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const result = assetService.create(userId, req.body);
    if (!result.ok) {
      return res.status(400).json({ message: result.message, errors: result.errors });
    }
    res.status(201).json(result.data);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** GET /api/assets/:id - 取得單一素材 */
assetRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const asset = assetService.get(userId, id);
    if (!asset) {
      return res.status(404).json({ message: "找不到該素材" });
    }
    res.json(asset);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** PUT /api/assets/:id - 更新素材 */
assetRouter.put("/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const result = assetService.update(userId, id, req.body);
    if (!result.ok) {
      return res.status(400).json({ message: result.message, errors: result.errors });
    }
    res.json(result.data);
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});

/** DELETE /api/assets/:id - 刪除素材 */
assetRouter.delete("/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const result = assetService.remove(userId, id);
    if (!result.ok) {
      return res.status(404).json({ message: result.message });
    }
    res.status(204).send();
  } catch (e) {
    res.status(401).json({ message: "未登入" });
  }
});
