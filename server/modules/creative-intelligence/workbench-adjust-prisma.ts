import { prisma } from "../../db";

function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getAdjustRow(userId: string, entityKey: string, dateKey = todayKey()) {
  return prisma.workbenchAdjustDaily.findUnique({
    where: { userId_entityKey_dateKey: { userId, entityKey, dateKey } },
  });
}

/** Commercial：偵測到原生後台變更後，將今日所有 entity 的 adjustCount 歸零（不刪列，保留歷史欄位）。 */
export async function resetAdjustCountsForUserToday(userId: string): Promise<number> {
  const dateKey = todayKey();
  const r = await prisma.workbenchAdjustDaily.updateMany({
    where: { userId, dateKey },
    data: { adjustCount: 0 },
  });
  return r.count;
}

export async function incrementAdjust(params: {
  userId: string;
  entityKey: string;
  adjustType: string;
  observationHours?: number;
}) {
  const dateKey = todayKey();
  const now = new Date();
  const windowH = params.observationHours ?? 3;
  const observationWindowUntil = new Date(now.getTime() + windowH * 3600 * 1000);
  const existing = await prisma.workbenchAdjustDaily.findUnique({
    where: { userId_entityKey_dateKey: { userId: params.userId, entityKey: params.entityKey, dateKey } },
  });
  const nextCount = (existing?.adjustCount ?? 0) + 1;
  return prisma.workbenchAdjustDaily.upsert({
    where: { userId_entityKey_dateKey: { userId: params.userId, entityKey: params.entityKey, dateKey } },
    create: {
      userId: params.userId,
      entityKey: params.entityKey,
      dateKey,
      adjustCount: 1,
      lastAdjustAt: now,
      lastAdjustType: params.adjustType,
      observationWindowUntil,
    },
    update: {
      adjustCount: nextCount,
      lastAdjustAt: now,
      lastAdjustType: params.adjustType,
      observationWindowUntil,
    },
  });
}
