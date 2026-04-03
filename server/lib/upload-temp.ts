/**
 * Phase 3：上傳暫存目錄與 disk storage，避免 memoryStorage OOM。
 * 完成後/失敗後 cleanup、檔名 sanitize、可選 MIME 驗證、啟動時清殘留。
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { StorageEngine } from "multer";

const SUBDIR = process.env.UPLOAD_TEMP_SUBDIR || "rich-bear-upload";
let _tempDir: string | null = null;

export function getUploadTempDir(): string {
  if (_tempDir) return _tempDir;
  const base = process.env.UPLOAD_TEMP_DIR || os.tmpdir();
  _tempDir = path.join(base, SUBDIR);
  return _tempDir;
}

export function ensureUploadTempDir(): string {
  const dir = getUploadTempDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  else cleanupStaleTempFiles();
  return dir;
}

/** 僅保留安全檔名字元，避免 path traversal 與怪字元 */
export function sanitizeUploadFilename(name: string): string {
  const base = path.basename(name || "upload");
  const safe = base.replace(/[^\w\u4e00-\u9fff.\- ]/gi, "_").slice(0, 200);
  return safe || `upload-${Date.now()}`;
}

/** 允許的 MIME 前綴（空陣列表示不限制） */
export const DEFAULT_ALLOWED_MIME_PREFIXES = [
  "image/",
  "video/",
  "application/pdf",
  "text/",
  "application/octet-stream",
];

export interface DiskStorageOptions {
  allowedMimePrefixes?: string[];
  maxFileSize?: number;
}

/**
 * 回傳 multer disk storage engine。檔案寫入 temp 目錄，由 route 在處理後呼叫 cleanupUploadTempFile(path)。
 */
export function createDiskStorage(opts: DiskStorageOptions = {}): StorageEngine {
  const allowed = opts.allowedMimePrefixes ?? DEFAULT_ALLOWED_MIME_PREFIXES;
  return {
    _handleFile(req, file, cb) {
      ensureUploadTempDir();
      const dir = getUploadTempDir();
      const raw = (file as { originalname?: string }).originalname && typeof (file as { originalname?: string }).originalname === "string"
        ? (file as { originalname: string }).originalname
        : "";
      const safeName = sanitizeUploadFilename(raw || "");
      const ext = path.extname(safeName) || "";
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
      const filepath = path.join(dir, name);

      if (allowed.length > 0) {
        const mime = (file.mimetype || "").toLowerCase();
        const ok = allowed.some((p) => mime.startsWith(p) || p === mime);
        if (!ok) {
          return cb(new Error(`不允許的檔案類型: ${file.mimetype || "unknown"}`));
        }
      }

      const out = fs.createWriteStream(filepath);
      file.stream.pipe(out);
      out.on("error", (err) => {
        try { fs.unlinkSync(filepath); } catch { /* ignore */ }
        cb(err);
      });
      out.on("finish", () => {
        cb(null, { path: filepath, size: out.bytesWritten });
      });
    },
    _removeFile(req, file, cb) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, (err) => cb(err));
      } else {
        cb(null);
      }
    },
  };
}

/** Route 處理完成後（成功或失敗）應呼叫，刪除暫存檔 */
export async function cleanupUploadTempFile(filePath: string | undefined): Promise<void> {
  if (!filePath || typeof filePath !== "string") return;
  const dir = getUploadTempDir();
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(dir))) return;
  try {
    await fs.promises.unlink(resolved);
  } catch {
    // ignore
  }
}

/** 啟動時清除過期暫存檔（預設 1 小時） */
export function cleanupStaleTempFiles(maxAgeMs: number = 60 * 60 * 1000): void {
  const dir = getUploadTempDir();
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const now = Date.now();
    for (const e of entries) {
      if (!e.isFile()) continue;
      const full = path.join(dir, e.name);
      try {
        const stat = fs.statSync(full);
        if (now - stat.mtimeMs > maxAgeMs) fs.unlinkSync(full);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
