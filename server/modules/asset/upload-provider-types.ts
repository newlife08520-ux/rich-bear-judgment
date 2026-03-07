/**
 * Upload Provider 抽象層型別。
 * 實作：local（.data/uploads）、NAS。
 * 由 UPLOAD_PROVIDER 環境變數切換，不寫死單一路徑。
 */

export interface SaveFileInput {
  userId: string;
  /** 可選：供 NAS 路徑使用（檔期、品牌、產品、packageId） */
  context?: { brand?: string; product?: string; period?: string; packageId?: string };
  originalName: string;
  mimeType: string;
  source: Buffer | string;
}

export type StorageProviderKey = "local" | "nas";

export interface SaveFileResult {
  fileUrl: string;
  fileName: string;
  fileType: string;
  /** 實際寫入的 provider，存進 AssetVersion 供讀檔時使用 */
  storageProvider: StorageProviderKey;
  storagePath?: string;
}

export interface IUploadProvider {
  saveFile(input: SaveFileInput): SaveFileResult;
  getFilePath(userId: string, filenameOrUrl: string): string | null;
  getPublicUrl(userId: string, fileUrlOrPath: string): string;
}
