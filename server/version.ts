import { readFileSync, existsSync } from "fs";
import path from "path";

export type BuildVersion = { commit: string; branch: string; timestamp: string };

let cached: BuildVersion | null = null;

export function getBuildVersion(): BuildVersion {
  if (cached) return cached;
  const versionPath = path.join(process.cwd(), "dist", "version.json");
  try {
    if (existsSync(versionPath)) {
      const raw = readFileSync(versionPath, "utf8");
      const v = JSON.parse(raw) as BuildVersion;
      cached = { commit: v.commit ?? "unknown", branch: v.branch ?? "unknown", timestamp: v.timestamp ?? "unknown" };
      return cached;
    }
  } catch {}
  cached = {
    commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    branch: process.env.RAILWAY_GIT_BRANCH ?? process.env.VERCEL_GIT_BRANCH ?? "unknown",
    timestamp: "unknown",
  };
  return cached;
}
