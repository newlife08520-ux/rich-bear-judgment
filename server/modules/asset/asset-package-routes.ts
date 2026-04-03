import multer from "multer";
import * as fs from "fs";
import { Router, type Request, type Response } from "express";
import * as assetPackageService from "./asset-package-service";
import * as assetVersionService from "./asset-version-service";
import * as assetGroupService from "./asset-group-service";
import * as uploadStorage from "./upload-storage";
import { detectMedia } from "./detect-media";
import { generateVideoThumbnail } from "./video-thumbnail";
import { createDiskStorage, cleanupUploadTempFile } from "../../lib/upload-temp";

export const assetPackageRouter = Router();

const upload = multer({
  storage: createDiskStorage({ allowedMimePrefixes: ["image/", "video/", "application/", "text/"] }),
  limits: { fileSize: 100 * 1024 * 1024 },
}).single("file");

function getUserId(req: Request): string {
  const id = (req as Request & { session: { userId?: string } }).session?.userId;
  if (!id) throw new Error("UNAUTHORIZED");
  return id;
}

function getParamId(req: Request, key: string): string {
  const p = req.params[key];
  return Array.isArray(p) ? p[0] ?? "" : p ?? "";
}

/** 確保回傳給前端的 fileUrl/thumbnailUrl 一律以 / 開頭，避免相對路徑導致 404 */
function normalizeVersionUrls<T extends { fileUrl?: string; thumbnailUrl?: string }>(v: T): T {
  const fileUrl = v.fileUrl?.trim();
  const thumbnailUrl = v.thumbnailUrl?.trim();
  return {
    ...v,
    ...(fileUrl && { fileUrl: fileUrl.startsWith("http") || fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}` }),
    ...(thumbnailUrl && { thumbnailUrl: thumbnailUrl.startsWith("http") || thumbnailUrl.startsWith("/") ? thumbnailUrl : `/${thumbnailUrl}` }),
  };
}

/** GET /api/asset-packages - 列出當前使用者的素材包 */
assetPackageRouter.get("/", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const list = assetPackageService.list(userId);
    res.json(list);
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** POST /api/asset-packages - 建立素材包 */
assetPackageRouter.post("/", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const result = assetPackageService.create(userId, req.body);
    if (!result.ok) {
      return res.status(400).json({ message: result.message, errors: result.errors });
    }
    res.status(201).json(result.data);
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** GET /api/asset-packages/:id - 取得單一素材包 */
assetPackageRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const pkg = assetPackageService.get(userId, id);
    if (!pkg) return res.status(404).json({ message: "找不到該素材包" });
    res.json(pkg);
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** PUT /api/asset-packages/:id - 更新素材包 */
assetPackageRouter.put("/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const result = assetPackageService.update(userId, id, req.body);
    if (!result.ok) {
      return res.status(400).json({ message: result.message, errors: result.errors });
    }
    res.json(result.data);
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** DELETE /api/asset-packages/:id - 刪除素材包 */
assetPackageRouter.delete("/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = getParamId(req, "id");
    const result = assetPackageService.remove(userId, id);
    if (!result.ok) return res.status(404).json({ message: result.message });
    res.status(204).send();
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** GET /api/asset-packages/:id/groups - 列出該素材包底下的主素材組 */
assetPackageRouter.get("/:id/groups", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const packageId = getParamId(req, "id");
    const pkg = assetPackageService.get(userId, packageId);
    if (!pkg) return res.status(404).json({ message: "找不到該素材包" });
    const groups = assetGroupService.listByPackage(userId, packageId);
    res.json(groups);
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** POST /api/asset-packages/:id/groups - 建立主素材組 */
assetPackageRouter.post("/:id/groups", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const packageId = getParamId(req, "id");
    const result = assetGroupService.create(userId, packageId, req.body);
    if (!result.ok) return res.status(400).json({ message: result.message });
    res.status(201).json(result.data);
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** PUT /api/asset-packages/:packageId/groups/:groupId - 更新主素材組 */
assetPackageRouter.put("/:id/groups/:groupId", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const packageId = getParamId(req, "id");
    const groupId = getParamId(req, "groupId");
    const group = assetGroupService.get(userId, groupId);
    if (!group || group.packageId !== packageId) return res.status(404).json({ message: "找不到該主素材組" });
    const result = assetGroupService.update(userId, groupId, req.body);
    if (!result.ok) return res.status(400).json({ message: result.message });
    res.json(result.data);
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** DELETE /api/asset-packages/:packageId/groups/:groupId - 刪除主素材組 */
assetPackageRouter.delete("/:id/groups/:groupId", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const packageId = getParamId(req, "id");
    const groupId = getParamId(req, "groupId");
    const group = assetGroupService.get(userId, groupId);
    if (!group || group.packageId !== packageId) return res.status(404).json({ message: "找不到該主素材組" });
    const result = assetGroupService.remove(userId, groupId);
    if (!result.ok) return res.status(400).json({ message: result.message });
    res.status(204).send();
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** GET /api/asset-packages/:id/versions - 列出該素材包底下的版本 */
assetPackageRouter.get("/:id/versions", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const packageId = getParamId(req, "id");
    const pkg = assetPackageService.get(userId, packageId);
    if (!pkg) return res.status(404).json({ message: "找不到該素材包" });
    const versions = assetVersionService.listByPackage(userId, packageId);
    res.json(versions.map(normalizeVersionUrls));
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});

/** POST /api/asset-packages/:id/versions/upload - 上傳檔案，回傳 { fileUrl, fileName, fileType }（權限：須為該素材包擁有者）；Phase 3 使用 disk temp，處理後 cleanup */
assetPackageRouter.post("/:id/versions/upload", (req: Request, res: Response) => {
  upload(req, res, async (err) => {
    const file = (req as Request & { file?: Express.Multer.File & { path?: string } }).file;
    const tempPath = file?.path;
    const cleanup = () => tempPath && cleanupUploadTempFile(tempPath);
    try {
      const userId = getUserId(req);
      const packageId = getParamId(req, "id");
      const pkg = assetPackageService.get(userId, packageId);
      if (!pkg) {
        return res.status(404).json({ message: "找不到該素材包或無權限" });
      }
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "檔案大小超過 100MB 限制" });
        }
        return res.status(400).json({ message: (err as Error).message });
      }
      if (!file) {
        return res.status(400).json({ message: "請選擇要上傳的檔案" });
      }
      const buffer = file.buffer ?? (tempPath && fs.existsSync(tempPath) ? await fs.promises.readFile(tempPath) : null);
      if (!buffer || !Buffer.isBuffer(buffer)) {
        return res.status(400).json({ message: "請選擇要上傳的檔案" });
      }
      const result = uploadStorage.saveFile(userId, file.originalname, file.mimetype || "", buffer);
      const detection = detectMedia(buffer, file.mimetype || "", file.originalname);
      const mime = (file.mimetype || "").toLowerCase();
      let thumbnailUrl: string | undefined;
      if (mime.startsWith("image/")) {
        thumbnailUrl = result.fileUrl;
      } else if (mime.startsWith("video/")) {
        thumbnailUrl = generateVideoThumbnail(userId, buffer, file.mimetype || "", file.originalname) ?? undefined;
      }
      const fileUrl = result.fileUrl.startsWith("http") || result.fileUrl.startsWith("/") ? result.fileUrl : `/${result.fileUrl}`;
      const thumbnailUrlOut = thumbnailUrl ? (thumbnailUrl.startsWith("http") || thumbnailUrl.startsWith("/") ? thumbnailUrl : `/${thumbnailUrl}`) : undefined;
      res.json({ ...result, fileUrl, thumbnailUrl: thumbnailUrlOut, detection });
    } catch (e) {
      if (!res.headersSent) res.status(401).json({ message: "未登入" });
    } finally {
      await cleanup();
    }
  });
});

/** POST /api/asset-packages/:id/versions - 在該素材包底下建立版本 */
assetPackageRouter.post("/:id/versions", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const packageId = getParamId(req, "id");
    const result = assetVersionService.create(userId, packageId, req.body);
    if (!result.ok) {
      return res.status(400).json({ message: result.message, errors: result.errors });
    }
    res.status(201).json(normalizeVersionUrls(result.data));
  } catch {
    res.status(401).json({ message: "未登入" });
  }
});
