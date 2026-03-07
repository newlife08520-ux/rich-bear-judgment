/**
 * NAS Upload Provider：檔案存於 NAS_BASE_PATH/{userId}/{filename}
 * fileUrl 與 local 一致：/api/uploads/{userId}/{filename}，由同一支 GET 經 getFilePath 讀取 NAS 路徑後 sendFile。
 * 需設定環境變數：UPLOAD_PROVIDER=nas，NAS_BASE_PATH=/path/to/mount（或 Windows 掛載點）
 * 啟動時會檢查 NAS_BASE_PATH 存在且可寫（fail-fast）。
 */

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import type { IUploadProvider, SaveFileInput, SaveFileResult } from "./upload-provider-types";

const URL_PREFIX = "/api/uploads";

function getNasBasePath(): string {
  const base = process.env.NAS_BASE_PATH;
  if (!base || !base.trim()) {
    throw new Error("NAS_BASE_PATH is required when UPLOAD_PROVIDER=nas");
  }
  return path.resolve(base.trim());
}

/** 啟動時或第一次使用 NAS 前呼叫：確認 NAS_BASE_PATH 存在且可寫，否則拋錯 */
export function checkNasConfig(): void {
  const base = getNasBasePath();
  if (!fs.existsSync(base)) {
    throw new Error(`NAS_BASE_PATH does not exist: ${base}`);
  }
  try {
    fs.accessSync(base, fs.constants.W_OK);
  } catch {
    throw new Error(`NAS_BASE_PATH is not writable: ${base}`);
  }
}

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

export function createNasUploadProvider(): IUploadProvider {
  checkNasConfig();
  const UPLOAD_BASE = getNasBasePath();

  return {
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
      return { fileUrl, fileName, fileType, storageProvider: "nas", storagePath: destPath };
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
      const base = getNasBasePath();
      const rel = path.relative(base, path.normalize(fileUrlOrPath));
      if (rel && !rel.startsWith("..")) {
        return process.env.NAS_PUBLIC_BASE_URL
          ? `${process.env.NAS_PUBLIC_BASE_URL.replace(/\/$/, "")}/${rel.replace(/\\/g, "/")}`
          : `${URL_PREFIX}/${rel.replace(/\\/g, "/")}`;
      }
      return fileUrlOrPath;
    },
  };
}
