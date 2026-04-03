/**
 * Execution 持久化：Prisma ExecutionRun 為 source of truth（取代 .data/execution-logs.json）
 */
import { prisma } from "../../db";
import type { ExecutionLogEntry } from "./execution-types";

function safeJsonParse<T>(raw: string | null): T | undefined {
  if (raw == null || raw === "") return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function safeJsonStringify(v: unknown): string | null {
  if (v == null) return null;
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

/** dry-run 時建立一筆 ExecutionRun（status=previewed） */
export async function recordDryRun(
  dryRunId: string,
  userId: string,
  actionType: string,
  payload: unknown,
  preview: { summary: string; steps: string[]; meta?: Record<string, unknown> }
): Promise<void> {
  await prisma.executionRun.create({
    data: {
      dryRunId,
      userId,
      actionType,
      status: "previewed",
      payloadJson: safeJsonStringify(payload),
      previewJson: safeJsonStringify(preview),
    },
  });
}

/** 依 dryRunId + userId 取得 dry_run 紀錄（供 apply 讀取 payload） */
export async function findDryRunByDryRunId(
  dryRunId: string,
  userId: string
): Promise<{ payload: unknown; actionType: string } | null> {
  const run = await prisma.executionRun.findUnique({
    where: { dryRunId },
  });
  if (!run || run.userId !== userId || run.status !== "previewed") return null;
  const payload = safeJsonParse<unknown>(run.payloadJson);
  return { payload: payload ?? {}, actionType: run.actionType };
}

/** 是否已有該 dryRunId 的 apply 紀錄（冪等） */
export async function hasApplyForDryRunId(dryRunId: string, userId: string): Promise<boolean> {
  const run = await prisma.executionRun.findUnique({
    where: { dryRunId },
  });
  return run != null && run.userId === userId && run.status === "applied";
}

/** apply 成功：更新為 applied，寫入 result */
export async function recordApply(
  dryRunId: string,
  userId: string,
  result: {
    resultSummary?: string;
    affectedIds?: string[];
    affectedCount?: number;
    resultMeta?: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date();
  await prisma.executionRun.updateMany({
    where: { dryRunId, userId: userId },
    data: {
      status: "applied",
      resultJson: safeJsonStringify(result),
      approvedAt: now,
      appliedAt: now,
    },
  });
}

/** apply 失敗：更新為 failed，寫入 error */
export async function recordApplyFailure(
  dryRunId: string,
  userId: string,
  errorMessage: string
): Promise<void> {
  await prisma.executionRun.updateMany({
    where: { dryRunId, userId: userId },
    data: {
      status: "failed",
      errorJson: safeJsonStringify({ message: errorMessage }),
    },
  });
}

/**
 * 寫入 rollback 備註（方案 A）
 * - 僅更新 rollbackNote，不將 status 改為 rollback_note，以保留「已套用 applied」語意
 * - 僅允許已套用成功（applied）之紀錄；舊資料若曾寫成 rollback_note，允許補註並還原 status 為 applied
 */
export async function appendRollbackNoteToRun(
  dryRunId: string,
  userId: string,
  note: string
): Promise<boolean> {
  const run = await prisma.executionRun.findUnique({
    where: { dryRunId },
  });
  if (!run || run.userId !== userId) return false;
  if (run.status !== "applied" && run.status !== "rollback_note") {
    return false;
  }
  const trimmed = note.slice(0, 2000);
  await prisma.executionRun.update({
    where: { id: run.id },
    data: {
      rollbackNote: trimmed,
      status: "applied",
    },
  });
  return true;
}

/** 查詢執行紀錄（供 /api/execution/logs），轉成 ExecutionLogEntry 列表 */
export async function readExecutionRuns(
  userId: string,
  limit: number
): Promise<ExecutionLogEntry[]> {
  const runs = await prisma.executionRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const entries: ExecutionLogEntry[] = [];
  for (const r of runs) {
    const preview = safeJsonParse<{ summary?: string; steps?: string[]; meta?: Record<string, unknown> }>(
      r.previewJson
    );
    const isAppliedLike = r.status === "applied" || r.status === "rollback_note";
    entries.push({
      id: r.id,
      timestamp: r.createdAt.toISOString(),
      userId: r.userId,
      kind: "dry_run",
      actionType: r.actionType,
      dryRunId: r.dryRunId,
      payload: safeJsonParse(r.payloadJson),
      planSummary: preview?.summary,
      planSteps: preview?.steps,
      planMeta: preview?.meta,
      status: r.status === "previewed" ? "recorded" : "recorded",
      message: undefined,
    });
    const appliedTs = r.appliedAt ?? (isAppliedLike ? r.createdAt : null);
    if (isAppliedLike && appliedTs) {
      const result = safeJsonParse<{
        resultSummary?: string;
        affectedIds?: string[];
        affectedCount?: number;
        resultMeta?: Record<string, unknown>;
      }>(r.resultJson);
      entries.push({
        id: `${r.id}-apply`,
        timestamp: appliedTs.toISOString(),
        userId: r.userId,
        kind: "apply",
        actionType: r.actionType,
        dryRunId: r.dryRunId,
        status: "applied",
        resultSummary: result?.resultSummary,
        affectedIds: result?.affectedIds,
        affectedCount: result?.affectedCount,
        resultMeta: result?.resultMeta,
        rollbackNote: r.rollbackNote ?? undefined,
      });
    } else if (r.status === "failed" && r.errorJson) {
      const err = safeJsonParse<{ message?: string }>(r.errorJson);
      entries.push({
        id: `${r.id}-apply`,
        timestamp: r.createdAt.toISOString(),
        userId: r.userId,
        kind: "apply",
        actionType: r.actionType,
        dryRunId: r.dryRunId,
        status: "applied_stub",
        errorMessage: err?.message ?? String(r.errorJson),
      });
    }
  }
  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
