import * as fs from "fs";
import * as path from "path";
import type { ExecutionLogEntry } from "./execution-types";

const DATA_DIR = path.join(process.cwd(), ".data");
const LOG_FILE = path.join(DATA_DIR, "execution-logs.json");

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readExecutionLogs(): ExecutionLogEntry[] {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const raw = fs.readFileSync(LOG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ExecutionLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendExecutionLog(entry: ExecutionLogEntry): void {
  ensureDir();
  const logs = readExecutionLogs();
  logs.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2) + "\n", "utf-8");
}

/** 依 dryRunId + userId 取得 dry_run 紀錄（供 apply 讀取 payload） */
export function findDryRunByDryRunId(
  dryRunId: string,
  userId: string
): ExecutionLogEntry | null {
  const logs = readExecutionLogs();
  const entry = logs.find(
    (e) => e.kind === "dry_run" && e.dryRunId === dryRunId && e.userId === userId
  );
  return entry ?? null;
}

/** 是否已有該 dryRunId 的 apply 紀錄（冪等） */
export function hasApplyForDryRunId(dryRunId: string, userId: string): boolean {
  const logs = readExecutionLogs();
  return logs.some(
    (e) => (e.kind === "apply" || e.status === "applied") && e.dryRunId === dryRunId && e.userId === userId
  );
}
