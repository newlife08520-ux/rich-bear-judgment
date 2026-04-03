import { Router, type Request, type Response } from "express";
import * as assetVersionService from "./asset-version-service";

export const assetVersionRouter = Router();

function normalizeVersionUrls<T extends { fileUrl?: string; thumbnailUrl?: string }>(v: T): T {
  const fileUrl = v.fileUrl?.trim();
  const thumbnailUrl = v.thumbnailUrl?.trim();
  return {
    ...v,
    ...(fileUrl && { fileUrl: fileUrl.startsWith("http") || fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}` }),
    ...(thumbnailUrl && { thumbnailUrl: thumbnailUrl.startsWith("http") || thumbnailUrl.startsWith("/") ? thumbnailUrl : `/${thumbnailUrl}` }),
  };
}

function getUserId(req: Request): string {
  const id = (req as Request & { session: { userId?: string } }).session?.userId;
  if (!id) throw new Error("UNAUTHORIZED");
  return id;
}

function getParamId(req: Request, key: string): string {
  const p = req.params[key];
  return Array.isArray(p) ? p[0] ?? "" : p ?? "";
}

/** PUT /api/asset-versions/:id - 更新素材版本（僅能更新屬於當前使用者的版本） */
assetVersionRouter.put("/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const result = assetVersionService.update(userId, id, req.body);
    if (!result.ok) {
      const isNotFound = result.message.includes("找不到") || result.message.includes("無權限");
      const status = isNotFound ? 404 : 400;
      const body: { message: string; errors?: unknown } = { message: result.message };
      if (status === 400 && result.errors) body.errors = result.errors;
      return res.status(status).json(body);
    }
    res.json(normalizeVersionUrls(result.data));
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** DELETE /api/asset-versions/:id - 刪除素材版本（僅能刪除屬於當前使用者的版本） */
assetVersionRouter.delete("/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const result = assetVersionService.remove(userId, id);
    if (!result.ok) return res.status(404).json({ message: result.message });
    res.status(204).send();
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});
