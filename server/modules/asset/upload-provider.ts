/**
 * 依 UPLOAD_PROVIDER 環境變數取得目前使用的 Upload Provider。
 * local（預設）：.data/uploads
 * nas：NAS_BASE_PATH，需設定 NAS_BASE_PATH（啟動時 fail-fast 檢查）
 * 讀檔時依 AssetVersion.storageProvider 決定用哪個 provider，不依目前系統設定。
 */

import type { IUploadProvider, StorageProviderKey } from "./upload-provider-types";
import { localUploadProvider } from "./upload-provider-local";
import { createNasUploadProvider } from "./upload-provider-nas";
import * as assetVersionRepo from "./asset-version-repository";

let _provider: IUploadProvider | null = null;
let _nasProvider: IUploadProvider | null = null;

function getProvider(): IUploadProvider {
  if (_provider) return _provider;
  const kind = (process.env.UPLOAD_PROVIDER || "local").toLowerCase();
  if (kind === "nas") {
    _provider = createNasUploadProvider();
  } else {
    _provider = localUploadProvider;
  }
  return _provider;
}

/** 目前系統使用的 provider 鍵名 */
export function getProviderKey(): StorageProviderKey {
  const kind = (process.env.UPLOAD_PROVIDER || "local").toLowerCase();
  return kind === "nas" ? "nas" : "local";
}

/** 依鍵名取得 provider（讀檔時依版本自己的 storageProvider 使用） */
export function getProviderByKey(key: StorageProviderKey): IUploadProvider {
  if (key === "nas") {
    if (!_nasProvider) _nasProvider = createNasUploadProvider();
    return _nasProvider;
  }
  return localUploadProvider;
}

/** 取得目前啟用的 Upload Provider（上傳寫入用） */
export function getUploadProvider(): IUploadProvider {
  return getProvider();
}

/**
 * 供 routes GET /api/uploads/:userId/:filename 使用。
 * 依該檔對應的 AssetVersion.storageProvider 決定用哪個 provider 讀檔；
 * 若查無版本或未設 storageProvider，視為 local（舊資料相容）。
 */
export function resolveFilePathForRequest(userId: string, filename: string): string | null {
  const fileUrl = `/api/uploads/${userId}/${filename}`;
  const version = assetVersionRepo.getByUserIdAndFileUrl(userId, fileUrl);
  const key: StorageProviderKey = (version?.storageProvider as StorageProviderKey) ?? "local";
  const provider = getProviderByKey(key);
  return provider.getFilePath(userId, filename);
}

/** 啟動時呼叫，強制初始化 provider；若為 NAS 會執行 fail-fast 檢查 */
export function ensureUploadProviderReady(): void {
  getUploadProvider();
}

// 供 upload-storage 委派與 asset-package-routes 直接使用
export { localUploadProvider } from "./upload-provider-local";
export type { IUploadProvider, SaveFileInput, SaveFileResult } from "./upload-provider-types";
