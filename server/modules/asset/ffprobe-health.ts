/**
 * 正式環境 ffprobe 可用性檢查。
 * 用於 GET /api/health/ffprobe，回報是否可執行、失敗時為安裝/PATH/權限/runtime 哪一類。
 */
import { execSync } from "child_process";

export type FfprobeHealthResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; code: "ENOENT" | "PERM" | "TIMEOUT" | "OTHER" };

/**
 * 執行 ffprobe -version，不寫檔、不讀影片。
 * 若失敗，依 error 訊息或 err.code 分類為 ENOENT（未安裝/不在 PATH）、PERM、TIMEOUT、OTHER。
 */
export function checkFfprobeAvailable(): FfprobeHealthResult {
  try {
    execSync("ffprobe -version", {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, message: "ffprobe 可執行" };
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException & { code?: string; killed?: boolean };
    const msg = err?.message ?? String(e);
    if (err?.code === "ENOENT" || /not found|ENOENT|spawn.*ffprobe/i.test(msg)) {
      return { ok: false, error: "ffprobe 未安裝或不在 PATH", code: "ENOENT" };
    }
    if (err?.code === "EPERM" || /permission|EPERM|EACCES/i.test(msg)) {
      return { ok: false, error: "權限不足，無法執行 ffprobe", code: "PERM" };
    }
    if (err?.killed === true || err?.code === "ETIMEDOUT" || /timeout|timed out/i.test(msg)) {
      return { ok: false, error: "執行逾時", code: "TIMEOUT" };
    }
    return { ok: false, error: msg || "執行 ffprobe 失敗", code: "OTHER" };
  }
}
