/**
 * 素材版本檔案上傳儲存 — 委派給 Upload Provider（local / NAS）。
 * 保留本模組的 saveFile / getFilePath 簽名以相容既有呼叫端；
 * 實作由 upload-provider 依 UPLOAD_PROVIDER 環境變數決定。
 */

import * as fs from "fs";
import * as path from "path";
import { getUploadProvider } from "./upload-provider";
import type { SaveFileResult } from "./upload-provider-types";

const UPLOAD_BASE = path.join(process.cwd(), ".data", "uploads");

export type SaveResult = { fileUrl: string; fileName: string; fileType: string; storageProvider: "local" | "nas" };

/** 僅在 local 時建立 .data/uploads/{userId}，供腳本或相容用；上傳由 provider 處理 */
export function ensureUserUploadDir(userId: string): string {
  const dir = path.join(UPLOAD_BASE, userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 將上傳內容存到目前 Provider（local 或 NAS），回傳可存進 DB 的 URL/檔名/類型。
 */
export function saveFile(
  userId: string,
  originalName: string,
  mimeType: string,
  source: Buffer | string
): SaveResult {
  const result: SaveFileResult = getUploadProvider().saveFile({
    userId,
    originalName,
    mimeType,
    source,
  });
  return { fileUrl: result.fileUrl, fileName: result.fileName, fileType: result.fileType, storageProvider: result.storageProvider };
}

/** 取得檔案實體路徑，供 GET 下載用；若不存在回傳 null */
export function getFilePath(userId: string, filename: string): string | null {
  return getUploadProvider().getFilePath(userId, filename);
}
