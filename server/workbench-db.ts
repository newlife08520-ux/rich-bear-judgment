/**
 * P2 Workbench 持久化：SQLite via Prisma（owners, tasks, audit, mapping）
 * 多人同時編輯依賴 updatedAt + 樂觀更新
 */
import { prisma } from "./db";
import { assembleOverlayText } from "./overlay-structured";
import type { WorkbenchProductOwners, WorkbenchTask, WorkbenchAuditEntry } from "@shared/workbench-types";

const ENTITY_CAMPAIGN = "campaign";

export async function getWorkbenchOwners(): Promise<WorkbenchProductOwners> {
  const rows = await prisma.workbenchOwner.findMany();
  const out: WorkbenchProductOwners = {};
  for (const r of rows) {
    out[r.productName] = {
      productOwnerId: r.productOwnerId,
      mediaOwnerId: r.mediaOwnerId,
      creativeOwnerId: r.creativeOwnerId,
      taskStatus: r.taskStatus as WorkbenchProductOwners[string]["taskStatus"],
    };
  }
  return out;
}

export async function patchWorkbenchProductOwner(
  productName: string,
  patch: Partial<WorkbenchProductOwners[string]>,
  userId: string
): Promise<void> {
  const existing = await prisma.workbenchOwner.findUnique({ where: { productName } });
  const cur = existing
    ? {
        productOwnerId: existing.productOwnerId,
        mediaOwnerId: existing.mediaOwnerId,
        creativeOwnerId: existing.creativeOwnerId,
        taskStatus: existing.taskStatus,
      }
    : { productOwnerId: "", mediaOwnerId: "", creativeOwnerId: "", taskStatus: "unassigned" };
  const next = { ...cur, ...patch };
  await prisma.workbenchOwner.upsert({
    where: { productName },
    create: {
      productName,
      productOwnerId: next.productOwnerId,
      mediaOwnerId: next.mediaOwnerId,
      creativeOwnerId: next.creativeOwnerId,
      taskStatus: next.taskStatus,
    },
    update: {
      productOwnerId: next.productOwnerId,
      mediaOwnerId: next.mediaOwnerId,
      creativeOwnerId: next.creativeOwnerId,
      taskStatus: next.taskStatus,
    },
  });
  await prisma.workbenchAudit.create({
    data: {
      userId,
      entityType: "product_owner",
      entityId: productName,
      action: "update",
      oldValue: JSON.stringify(existing ?? null),
      newValue: JSON.stringify(next),
    },
  });
}

export async function getWorkbenchTasks(options?: { assigneeId?: string | null }): Promise<WorkbenchTask[]> {
  const where = options?.assigneeId !== undefined && options.assigneeId !== null && options.assigneeId !== ""
    ? { assigneeId: options.assigneeId }
    : undefined;
  const rows = await prisma.workbenchTask.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    productName: r.productName ?? undefined,
    creativeId: r.creativeId ?? undefined,
    draftId: r.draftId ?? undefined,
    reviewSessionId: r.reviewSessionId ?? undefined,
    title: r.title,
    action: r.action,
    reason: r.reason,
    assigneeId: r.assigneeId ?? null,
    status: r.status as WorkbenchTask["status"],
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    notes: r.notes,
    taskSource: r.taskSource ?? undefined,
    priority: r.priority ?? undefined,
    dueDate: r.dueDate?.toISOString() ?? undefined,
    impactAmount: r.impactAmount ?? undefined,
    taskType: r.taskType ?? undefined,
  }));
}

export async function createWorkbenchTask(
  input: Omit<WorkbenchTask, "id" | "createdAt" | "updatedAt">
): Promise<WorkbenchTask> {
  const t = await prisma.workbenchTask.create({
    data: {
      productName: input.productName ?? null,
      creativeId: input.creativeId ?? null,
      draftId: input.draftId ?? null,
      reviewSessionId: input.reviewSessionId ?? null,
      title: input.title,
      action: input.action,
      reason: input.reason,
      assigneeId: input.assigneeId ?? null,
      status: input.status,
      createdBy: input.createdBy,
      notes: input.notes ?? "",
      taskSource: input.taskSource ?? null,
      priority: input.priority ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      impactAmount: input.impactAmount ?? null,
      taskType: input.taskType ?? null,
    },
  });
  await prisma.workbenchAudit.create({
    data: {
      userId: input.createdBy,
      entityType: "task",
      entityId: t.id,
      action: "create",
      newValue: JSON.stringify(t),
    },
  });
  return rowToTask(t);
}

function rowToTask(r: { id: string; productName: string | null; creativeId: string | null; draftId: string | null; reviewSessionId: string | null; title: string; action: string; reason: string; assigneeId: string | null; status: string; createdBy: string; createdAt: Date; updatedAt: Date; notes: string; taskSource: string | null; priority: string | null; dueDate: Date | null; impactAmount: string | null; taskType: string | null }): WorkbenchTask {
  return {
    id: r.id,
    productName: r.productName ?? undefined,
    creativeId: r.creativeId ?? undefined,
    draftId: r.draftId ?? undefined,
    reviewSessionId: r.reviewSessionId ?? undefined,
    title: r.title,
    action: r.action,
    reason: r.reason,
    assigneeId: r.assigneeId ?? null,
    status: r.status as WorkbenchTask["status"],
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    notes: r.notes,
    taskSource: r.taskSource ?? undefined,
    priority: r.priority ?? undefined,
    dueDate: r.dueDate?.toISOString() ?? undefined,
    impactAmount: r.impactAmount ?? undefined,
    taskType: r.taskType ?? undefined,
  };
}

/** 回傳型：成功回傳 task；衝突（樂觀鎖）回傳 { conflict: true }；不存在回傳 null。傳入 clientUpdatedAt 時以 DB 條件更新，避免互蓋。 */
export async function updateWorkbenchTask(
  id: string,
  patch: Partial<Pick<WorkbenchTask, "assigneeId" | "status" | "notes" | "priority" | "dueDate" | "impactAmount" | "taskType" | "taskSource">>,
  userId: string,
  clientUpdatedAt?: string | null
): Promise<WorkbenchTask | { conflict: true } | null> {
  const old = await prisma.workbenchTask.findUnique({ where: { id } });
  if (!old) return null;
  const useOptimistic = clientUpdatedAt != null && clientUpdatedAt !== "";
  const data: Parameters<typeof prisma.workbenchTask.update>[0]["data"] = {
    ...(patch.assigneeId !== undefined && { assigneeId: patch.assigneeId }),
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.notes !== undefined && { notes: patch.notes }),
    ...(patch.taskSource !== undefined && { taskSource: patch.taskSource ?? null }),
    ...(patch.priority !== undefined && { priority: patch.priority ?? null }),
    ...(patch.dueDate !== undefined && { dueDate: patch.dueDate ? new Date(patch.dueDate) : null }),
    ...(patch.impactAmount !== undefined && { impactAmount: patch.impactAmount ?? null }),
    ...(patch.taskType !== undefined && { taskType: patch.taskType ?? null }),
  };
  let updated: Awaited<ReturnType<typeof prisma.workbenchTask.update>>;
  if (useOptimistic) {
    const clientAt = new Date(clientUpdatedAt!).getTime();
    if (Number.isNaN(clientAt)) return { conflict: true };
    const result = await prisma.workbenchTask.updateMany({
      where: { id, updatedAt: new Date(clientUpdatedAt!) },
      data,
    });
    if (result.count === 0) return { conflict: true };
    const row = await prisma.workbenchTask.findUnique({ where: { id } });
    if (!row) return null;
    updated = row;
  } else {
    updated = await prisma.workbenchTask.update({
      where: { id },
      data,
    });
  }
  await prisma.workbenchAudit.create({
    data: {
      userId,
      entityType: "task",
      entityId: id,
      action: "update",
      oldValue: JSON.stringify(old),
      newValue: JSON.stringify(updated),
    },
  });
  return rowToTask(updated);
}

export type BatchUpdateTaskResult = {
  successCount: number;
  failCount: number;
  errors: { id: string; message: string }[];
};

/** 批次更新任務（狀態或指派），逐筆更新並回傳成功/失敗筆數與錯誤摘要 */
export async function batchUpdateWorkbenchTasks(
  ids: string[],
  patch: { status?: string; assigneeId?: string | null },
  userId: string
): Promise<BatchUpdateTaskResult> {
  const errors: { id: string; message: string }[] = [];
  let successCount = 0;
  const data: Parameters<typeof prisma.workbenchTask.update>[0]["data"] = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.assigneeId !== undefined) data.assigneeId = patch.assigneeId;
  if (Object.keys(data).length === 0) return { successCount: 0, failCount: ids.length, errors: ids.map((id) => ({ id, message: "無有效更新欄位" })) };

  for (const id of ids) {
    try {
      await prisma.workbenchTask.update({ where: { id }, data });
      successCount++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ id, message });
    }
  }
  await prisma.workbenchAudit.create({
    data: {
      userId,
      entityType: "task",
      entityId: `batch:${ids.join(",")}`,
      action: "update",
      newValue: JSON.stringify({ patch, successCount, failCount: errors.length, errorIds: errors.map((x) => x.id) }),
    },
  });
  return { successCount, failCount: errors.length, errors };
}

export async function getWorkbenchTask(id: string): Promise<WorkbenchTask | null> {
  const t = await prisma.workbenchTask.findUnique({ where: { id } });
  if (!t) return null;
  return rowToTask(t);
}

export async function getWorkbenchAuditLog(limit = 100): Promise<WorkbenchAuditEntry[]> {
  const rows = await prisma.workbenchAudit.findMany({
    take: limit,
    orderBy: { at: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    entityType: r.entityType as WorkbenchAuditEntry["entityType"],
    entityId: r.entityId,
    action: r.action as WorkbenchAuditEntry["action"],
    oldValue: r.oldValue != null ? JSON.parse(r.oldValue) : undefined,
    newValue: r.newValue != null ? JSON.parse(r.newValue) : undefined,
    at: r.at.toISOString(),
  }));
}

/** 取得所有 mapping overrides，用於彙總解析。key = entityType:entityId, value = productName */
export async function getWorkbenchMappingOverrides(): Promise<Map<string, string>> {
  const rows = await prisma.workbenchMapping.findMany();
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(`${r.entityType}:${r.entityId}`, r.productName);
  }
  return map;
}

/** 依層級解析單一 row 的 productName：creative > ad > adset > campaign > parse */
export function resolveProductWithOverrides(
  row: { campaignId: string; campaignName: string; adSetId?: string; adId?: string; creativeId?: string },
  overrides: Map<string, string>,
  parseProduct: (campaignName: string) => string | null
): string | null {
  if (row.creativeId && overrides.has(`creative:${row.creativeId}`))
    return overrides.get(`creative:${row.creativeId}`)!;
  if (row.adId && overrides.has(`ad:${row.adId}`)) return overrides.get(`ad:${row.adId}`)!;
  if (row.adSetId && overrides.has(`adset:${row.adSetId}`)) return overrides.get(`adset:${row.adSetId}`)!;
  if (overrides.has(`campaign:${row.campaignId}`)) return overrides.get(`campaign:${row.campaignId}`)!;
  return parseProduct(row.campaignName);
}

export async function setWorkbenchMappingOverride(
  entityType: string,
  entityId: string,
  productName: string,
  userId: string
): Promise<void> {
  const old = await prisma.workbenchMapping.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
  });
  await prisma.workbenchMapping.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, productName },
    update: { productName },
  });
  await prisma.workbenchAudit.create({
    data: {
      userId,
      entityType: "mapping",
      entityId: `${entityType}:${entityId}`,
      action: "update",
      oldValue: old ? JSON.stringify(old) : null,
      newValue: JSON.stringify({ entityType, entityId, productName }),
    },
  });
}

/** 取得 mapping 清單（用於 mapping 頁面與 context API） */
export async function getWorkbenchMappingRecord(): Promise<Record<string, string>> {
  const rows = await prisma.workbenchMapping.findMany();
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.entityType === ENTITY_CAMPAIGN) out[r.entityId] = r.productName;
  }
  return out;
}

// ---------- P2-3 Threshold / Prompt 版本化 ----------
const DEFAULT_THRESHOLD_CONFIG = {
  spendThresholdStop: 1500,
  roasTargetMin: 1.0,
  roasScaleMin: 2.5,
  ctrHigh: 2.5,
  frequencyFatigue: 8,
  minSpendForRules: 300,
  // ROI-funnel：資料量與運氣單 / 漏斗健康
  minClicks: 50,
  minATC: 3,
  minPurchases: 2,
  minSpend: 300,
  funnelAtcTolerance: 0.2,
  funnelPurchaseTolerance: 0.2,
  luckySpendThreshold: 500,
  luckyMinPurchasesToExclude: 2,
};

export async function getPublishedThresholdConfig(): Promise<Record<string, unknown> | null> {
  const row = await prisma.thresholdVersion.findFirst({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
  });
  if (!row) return null;
  try {
    return JSON.parse(row.config) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getDraftThresholdConfig(): Promise<Record<string, unknown> | null> {
  const row = await prisma.thresholdVersion.findFirst({
    where: { status: "draft" },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  try {
    return JSON.parse(row.config) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function saveDraftThresholdConfig(config: Record<string, unknown>, userId: string): Promise<void> {
  const existing = await prisma.thresholdVersion.findFirst({
    where: { status: "draft" },
  });
  const configStr = JSON.stringify(config);
  if (existing) {
    await prisma.thresholdVersion.update({
      where: { id: existing.id },
      data: { config: configStr },
    });
  } else {
    await prisma.thresholdVersion.create({
      data: { kind: "global", config: configStr, status: "draft" },
    });
  }
}

export async function publishThreshold(userId: string): Promise<boolean> {
  const draft = await prisma.thresholdVersion.findFirst({
    where: { status: "draft" },
    orderBy: { updatedAt: "desc" },
  });
  if (!draft) return false;
  await prisma.thresholdVersion.update({
    where: { id: draft.id },
    data: { status: "published", publishedAt: new Date() },
  });
  await prisma.workbenchAudit.create({
    data: {
      userId,
      entityType: "threshold",
      entityId: draft.id,
      action: "publish",
      oldValue: JSON.stringify({ status: "draft", config: draft.config }),
      newValue: JSON.stringify({ status: "published", id: draft.id }),
    },
  });
  return true;
}

export async function rollbackThreshold(userId: string): Promise<boolean> {
  const published = await prisma.thresholdVersion.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 2,
  });
  if (published.length < 2) return false;
  const prev = published[1]!;
  await prisma.thresholdVersion.update({
    where: { id: published[0]!.id },
    data: { status: "draft", publishedAt: null },
  });
  await prisma.workbenchAudit.create({
    data: {
      userId,
      entityType: "threshold",
      entityId: published[0]!.id,
      action: "rollback",
      oldValue: JSON.stringify({ status: "published", id: published[0]!.id }),
      newValue: JSON.stringify({ status: "draft", rolledBackTo: prev.id }),
    },
  });
  return true;
}

export async function getPublishedPrompt(mode: string): Promise<string | null> {
  const row = await prisma.promptVersion.findFirst({
    where: { mode, status: "published" },
    orderBy: { publishedAt: "desc" },
  });
  if (!row) return null;
  return assembleOverlayText(mode, row.structuredOverlay, row.content);
}

/** 已發布 prompt 含摘要與時間，供設定頁已發布區顯示 */
export async function getPublishedPromptWithMeta(mode: string): Promise<{
  content: string | null;
  publishedAt: string | null;
  summary: string;
  publishedStructured: string | null;
} | null> {
  const row = await prisma.promptVersion.findFirst({
    where: { mode, status: "published" },
    orderBy: { publishedAt: "desc" },
  });
  if (!row) return null;
  const assembled = assembleOverlayText(mode, row.structuredOverlay, row.content);
  const lines = assembled.trim().split(/\r?\n/).filter(Boolean);
  const summary = lines.slice(0, 3).join("\n") || "（無內容摘要）";
  return {
    content: row.content,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    summary,
    publishedStructured: row.structuredOverlay,
  };
}

export async function getDraftPrompt(mode: string): Promise<string | null> {
  const row = await prisma.promptVersion.findFirst({
    where: { mode, status: "draft" },
    orderBy: { updatedAt: "desc" },
  });
  return row?.content ?? null;
}

/** 取得草稿內容與結構化欄位（供設定頁編輯） */
export async function getDraftPromptWithStructured(mode: string): Promise<{
  content: string | null;
  structuredOverlay: string | null;
}> {
  const row = await prisma.promptVersion.findFirst({
    where: { mode, status: "draft" },
    orderBy: { updatedAt: "desc" },
  });
  return {
    content: row?.content ?? null,
    structuredOverlay: row?.structuredOverlay ?? null,
  };
}

export async function saveDraftPrompt(
  mode: string,
  content: string,
  structuredOverlay?: string | null
): Promise<void> {
  const existing = await prisma.promptVersion.findFirst({
    where: { mode, status: "draft" },
  });
  if (existing) {
    await prisma.promptVersion.update({
      where: { id: existing.id },
      data: { content, structuredOverlay: structuredOverlay ?? undefined },
    });
  } else {
    await prisma.promptVersion.create({
      data: { mode, content, status: "draft", structuredOverlay: structuredOverlay ?? undefined },
    });
  }
}

export async function publishPrompt(mode: string, userId?: string): Promise<boolean> {
  const draft = await prisma.promptVersion.findFirst({
    where: { mode, status: "draft" },
    orderBy: { updatedAt: "desc" },
  });
  if (!draft) return false;
  await prisma.promptVersion.update({
    where: { id: draft.id },
    data: { status: "published", publishedAt: new Date() },
  });
  if (userId) {
    await prisma.workbenchAudit.create({
      data: {
        userId,
        entityType: "prompt",
        entityId: `${mode}:${draft.id}`,
        action: "publish",
        oldValue: JSON.stringify({ mode, status: "draft" }),
        newValue: JSON.stringify({ mode, id: draft.id, status: "published" }),
      },
    });
  }
  return true;
}

export async function rollbackPrompt(mode: string, userId?: string): Promise<boolean> {
  const published = await prisma.promptVersion.findMany({
    where: { mode, status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 2,
  });
  if (published.length < 2) return false;
  const prev = published[1]!;
  await prisma.promptVersion.update({
    where: { id: published[0]!.id },
    data: { status: "draft", publishedAt: null },
  });
  if (userId) {
    await prisma.workbenchAudit.create({
      data: {
        userId,
        entityType: "prompt",
        entityId: `${mode}:${published[0]!.id}`,
        action: "rollback",
        oldValue: JSON.stringify({ mode, status: "published" }),
        newValue: JSON.stringify({ mode, rolledBackTo: prev.id }),
      },
    });
  }
  return true;
}
