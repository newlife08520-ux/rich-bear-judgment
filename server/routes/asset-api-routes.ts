import type { Express, Request, Response, NextFunction } from "express";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { assetRouter } from "../modules/asset/asset-routes";
import { assetPackageRouter } from "../modules/asset/asset-package-routes";
import { assetVersionRouter } from "../modules/asset/asset-version-routes";
import { resolveFilePathForRequest } from "../modules/asset/upload-provider";

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

export function registerAssetApiRoutes(app: Express, requireAuth: RequireAuth): void {
  app.use("/api/assets", requireAuth, assetRouter);
  app.use("/api/asset-packages", requireAuth, assetPackageRouter);
  app.use("/api/asset-versions", requireAuth, assetVersionRouter);

  app.get("/api/uploads/:userId/:filename", requireAuth, (req, res) => {
    const sessionUserId = req.session.userId;
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
    if (!userId || !filename) {
      return res.status(404).json({ message: "?????" });
    }
    if (sessionUserId !== userId) {
      return res.status(403).json({ message: "????????" });
    }
    let decodedFilename = filename;
    try {
      decodedFilename = decodeURIComponent(filename);
    } catch {
      decodedFilename = filename;
    }
    const filePath = resolveFilePathForRequest(userId, filename);
    const targetPathSimple = path.resolve(process.cwd(), ".data", "uploads", userId, decodedFilename);
    console.log("\n--- [???????Debug] ---");
    console.log("1. ?????? URL:", req.originalUrl);
    console.log("2. ??????? userId:", userId, "| filename (decoded):", decodedFilename);
    console.log("3. ?? resolveFilePathForRequest ??????:", filePath ?? "(null)");
    console.log("4. ?????? .data/uploads/userId/filename:", targetPathSimple);
    console.log("5. resolveFilePathForRequest ???????? (fs.existsSync)?:", filePath ? fs.existsSync(filePath) : false);
    console.log("6. ????????????", fs.existsSync(targetPathSimple));
    console.log("------------------------\n");
    if (!filePath) {
      return res.status(404).json({ message: "?????" });
    }
    res.sendFile(filePath, { dotfiles: "allow" }, (err: unknown) => {
      if (err) {
        console.error("sendFile error:", err);
        if (!res.headersSent) {
          const status = (err as { status?: number }).status ?? 500;
          res.status(status).end();
        }
      }
    });
  });

  app.post("/api/upload", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const fileName = req.body?.fileName || `upload-${Date.now()}.png`;
    const fileType = req.body?.fileType || "image/png";
    const size = req.body?.size || Math.round(Math.random() * 5000000);
    const id = randomUUID().slice(0, 8);
    const pathSeg = encodeURIComponent(fileName);
    res.json({
      id,
      fileName,
      fileType,
      url: `/api/uploads/${userId}/${pathSeg}`,
      size,
    });
  });
}
