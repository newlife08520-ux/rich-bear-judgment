/**
 * Local Upload Provider：檔案存於 .data/uploads/{userId}/{filename}
 * fileUrl 為 /api/uploads/{userId}/{filename}，由 routes GET 提供下載。
 */

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import type { IUploadProvider, SaveFileInput, SaveFileResult } from "./upload-provider-types";

const UPLOAD_BASE = path.join(process.cwd(), ".data", "uploads");
const URL_PREFIX = "/api/uploads";

function safeBasename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
}

function getExtensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
  };
  return map[mime] || "";
}

export const localUploadProvider: IUploadProvider = {
  saveFile(input: SaveFileInput): SaveFileResult {
    const { userId, originalName, mimeType, source } = input;
    const dir = path.join(UPLOAD_BASE, userId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const ext = path.extname(safeBasename(originalName)) || getExtensionFromMime(mimeType);
    const baseName = safeBasename(path.basename(originalName, path.extname(originalName))) || "file";
    const filename = `${randomUUID().slice(0, 8)}_${baseName}${ext}`;
    const destPath = path.join(dir, filename);
    if (Buffer.isBuffer(source)) {
      fs.writeFileSync(destPath, source);
    } else {
      fs.copyFileSync(source, destPath);
    }
    const fileUrl = `${URL_PREFIX}/${userId}/${filename}`;
    const fileName = baseName + ext;
    const fileType = mimeType || "application/octet-stream";
    return { fileUrl, fileName, fileType, storageProvider: "local", storagePath: destPath };
  },

  getFilePath(userId: string, filenameOrUrl: string): string | null {
    const raw = (filenameOrUrl ?? "").split("?")[0]?.trim() || "";
    const filename = path.basename(raw);
    if (!filename || filename.includes("..") || filename.includes(path.sep)) return null;
    const full = path.join(UPLOAD_BASE, userId, filename);
    if (!path.resolve(full).startsWith(path.resolve(UPLOAD_BASE))) return null;
    return fs.existsSync(full) ? full : null;
  },

  getPublicUrl(_userId: string, fileUrlOrPath: string): string {
    if (fileUrlOrPath.startsWith("/api/uploads/")) return fileUrlOrPath;
    const rel = path.relative(UPLOAD_BASE, path.normalize(fileUrlOrPath));
    if (rel && !rel.startsWith("..") && path.sep === "\\") return `${URL_PREFIX}/${rel.replace(/\\/g, "/")}`;
    if (rel && !rel.startsWith("..")) return `${URL_PREFIX}/${rel}`;
    return fileUrlOrPath;
  },
};
