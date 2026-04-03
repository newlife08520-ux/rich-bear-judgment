/**
 * Publish 持久化：Prisma 為 release-grade source of truth（取代 .data/publish-drafts.json / publish-logs.json）
 */
import type { PublishDraft, PublishLog } from "@shared/schema";
import { prisma } from "../../db";

function jsonEncode(v: unknown): string | null {
  if (v == null) return null;
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

function jsonDecode<T>(s: string | null): T | undefined {
  if (s == null || s === "") return undefined;
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

function draftToRecord(d: PublishDraft) {
  return {
    id: d.id,
    userId: d.userId,
    batchId: d.batchId ?? null,
    accountId: d.accountId,
    pageId: d.pageId ?? null,
    igAccountId: d.igAccountId ?? null,
    campaignObjective: d.campaignObjective,
    campaignName: d.campaignName,
    adSetName: d.adSetName,
    adName: d.adName,
    budgetDaily: d.budgetDaily ?? null,
    budgetTotal: d.budgetTotal ?? null,
    scheduleStart: d.scheduleStart ?? null,
    scheduleEnd: d.scheduleEnd ?? null,
    audienceStrategy: d.audienceStrategy,
    placementStrategy: d.placementStrategy,
    assetPackageId: d.assetPackageId ?? null,
    selectedVersionIdsJson: jsonEncode(d.selectedVersionIds),
    assetIdsJson: jsonEncode(d.assetIds),
    primaryCopy: d.primaryCopy ?? null,
    headline: d.headline ?? null,
    note: d.note ?? null,
    cta: d.cta ?? null,
    landingPageUrl: d.landingPageUrl ?? null,
    status: d.status,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
    lastExecutionStatus: d.lastExecutionStatus ?? null,
    lastExecutionAt: d.lastExecutionAt ? new Date(d.lastExecutionAt) : null,
    lastExecutionSummary: d.lastExecutionSummary ?? null,
    metaCampaignId: d.metaCampaignId ?? null,
    metaAdSetId: d.metaAdSetId ?? null,
    metaAdId: d.metaAdId ?? null,
    metaCreativeId: d.metaCreativeId ?? null,
  };
}

function recordToDraft(r: {
  id: string;
  userId: string;
  batchId: string | null;
  accountId: string;
  pageId: string | null;
  igAccountId: string | null;
  campaignObjective: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  budgetDaily: number | null;
  budgetTotal: number | null;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  audienceStrategy: string;
  placementStrategy: string;
  assetPackageId: string | null;
  selectedVersionIdsJson: string | null;
  assetIdsJson: string | null;
  primaryCopy: string | null;
  headline: string | null;
  note: string | null;
  cta: string | null;
  landingPageUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastExecutionStatus: string | null;
  lastExecutionAt: Date | null;
  lastExecutionSummary: string | null;
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  metaAdId: string | null;
  metaCreativeId: string | null;
}): PublishDraft {
  return {
    id: r.id,
    userId: r.userId,
    batchId: r.batchId ?? undefined,
    accountId: r.accountId,
    pageId: r.pageId ?? undefined,
    igAccountId: r.igAccountId ?? undefined,
    campaignObjective: r.campaignObjective,
    campaignName: r.campaignName,
    adSetName: r.adSetName,
    adName: r.adName,
    budgetDaily: r.budgetDaily ?? undefined,
    budgetTotal: r.budgetTotal ?? undefined,
    scheduleStart: r.scheduleStart ?? undefined,
    scheduleEnd: r.scheduleEnd ?? undefined,
    audienceStrategy: r.audienceStrategy as PublishDraft["audienceStrategy"],
    placementStrategy: r.placementStrategy as PublishDraft["placementStrategy"],
    assetPackageId: r.assetPackageId ?? undefined,
    selectedVersionIds: jsonDecode<string[]>(r.selectedVersionIdsJson),
    assetIds: (jsonDecode<string[]>(r.assetIdsJson) ?? []) as PublishDraft["assetIds"],
    primaryCopy: r.primaryCopy ?? undefined,
    headline: r.headline ?? undefined,
    note: r.note ?? undefined,
    cta: r.cta ?? undefined,
    landingPageUrl: r.landingPageUrl ?? undefined,
    status: r.status as PublishDraft["status"],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lastExecutionStatus: r.lastExecutionStatus ?? undefined,
    lastExecutionAt: r.lastExecutionAt?.toISOString(),
    lastExecutionSummary: r.lastExecutionSummary ?? undefined,
    metaCampaignId: r.metaCampaignId ?? undefined,
    metaAdSetId: r.metaAdSetId ?? undefined,
    metaAdId: r.metaAdId ?? undefined,
    metaCreativeId: r.metaCreativeId ?? undefined,
  };
}

export async function listDraftsByUserId(userId: string): Promise<PublishDraft[]> {
  const rows = await prisma.publishDraftRecord.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(recordToDraft);
}

export async function getDraftById(userId: string, id: string): Promise<PublishDraft | null> {
  const row = await prisma.publishDraftRecord.findFirst({
    where: { id, userId },
  });
  return row ? recordToDraft(row) : null;
}

export async function createDraft(userId: string, draft: PublishDraft): Promise<PublishDraft> {
  await prisma.publishDraftRecord.create({
    data: draftToRecord(draft),
  });
  return draft;
}

export async function updateDraft(
  userId: string,
  id: string,
  patch: Partial<Omit<PublishDraft, "id" | "userId" | "createdAt">>
): Promise<PublishDraft | null> {
  const existing = await prisma.publishDraftRecord.findFirst({
    where: { id, userId },
  });
  if (!existing) return null;
  const updated = await prisma.publishDraftRecord.update({
    where: { id },
    data: {
      ...(patch.accountId != null && { accountId: patch.accountId }),
      ...(patch.pageId !== undefined && { pageId: patch.pageId ?? null }),
      ...(patch.igAccountId !== undefined && { igAccountId: patch.igAccountId ?? null }),
      ...(patch.campaignObjective != null && { campaignObjective: patch.campaignObjective }),
      ...(patch.campaignName != null && { campaignName: patch.campaignName }),
      ...(patch.adSetName != null && { adSetName: patch.adSetName }),
      ...(patch.adName != null && { adName: patch.adName }),
      ...(patch.budgetDaily !== undefined && { budgetDaily: patch.budgetDaily ?? null }),
      ...(patch.budgetTotal !== undefined && { budgetTotal: patch.budgetTotal ?? null }),
      ...(patch.scheduleStart !== undefined && { scheduleStart: patch.scheduleStart ?? null }),
      ...(patch.scheduleEnd !== undefined && { scheduleEnd: patch.scheduleEnd ?? null }),
      ...(patch.audienceStrategy != null && { audienceStrategy: patch.audienceStrategy }),
      ...(patch.placementStrategy != null && { placementStrategy: patch.placementStrategy }),
      ...(patch.assetPackageId !== undefined && { assetPackageId: patch.assetPackageId ?? null }),
      ...(patch.selectedVersionIds !== undefined && {
        selectedVersionIdsJson: jsonEncode(patch.selectedVersionIds),
      }),
      ...(patch.assetIds !== undefined && { assetIdsJson: jsonEncode(patch.assetIds) }),
      ...(patch.primaryCopy !== undefined && { primaryCopy: patch.primaryCopy ?? null }),
      ...(patch.headline !== undefined && { headline: patch.headline ?? null }),
      ...(patch.note !== undefined && { note: patch.note ?? null }),
      ...(patch.cta !== undefined && { cta: patch.cta ?? null }),
      ...(patch.landingPageUrl !== undefined && {
        landingPageUrl: patch.landingPageUrl ?? null,
      }),
      ...(patch.status != null && { status: patch.status }),
      ...(patch.batchId !== undefined && { batchId: patch.batchId ?? null }),
      ...(patch.lastExecutionStatus !== undefined && {
        lastExecutionStatus: patch.lastExecutionStatus ?? null,
      }),
      ...(patch.lastExecutionAt !== undefined && {
        lastExecutionAt: patch.lastExecutionAt ? new Date(patch.lastExecutionAt) : null,
      }),
      ...(patch.lastExecutionSummary !== undefined && {
        lastExecutionSummary: patch.lastExecutionSummary ?? null,
      }),
      ...(patch.metaCampaignId !== undefined && { metaCampaignId: patch.metaCampaignId ?? null }),
      ...(patch.metaAdSetId !== undefined && { metaAdSetId: patch.metaAdSetId ?? null }),
      ...(patch.metaAdId !== undefined && { metaAdId: patch.metaAdId ?? null }),
      ...(patch.metaCreativeId !== undefined && { metaCreativeId: patch.metaCreativeId ?? null }),
      updatedAt: (patch as { updatedAt?: string }).updatedAt
        ? new Date((patch as { updatedAt: string }).updatedAt)
        : new Date(),
    },
  });
  return recordToDraft(updated);
}

export async function listLogsByUserId(userId: string): Promise<PublishLog[]> {
  const rows = await prisma.publishLogRecord.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    draftId: r.draftId ?? "",
    status: r.status,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    ...(r.metaJson && (jsonDecode<Record<string, unknown>>(r.metaJson) ?? {})),
  })) as PublishLog[];
}

export async function appendLog(userId: string, log: PublishLog): Promise<PublishLog> {
  const meta = { name: log.name, accountId: log.accountId, campaignObjective: log.campaignObjective, audienceStrategy: log.audienceStrategy, placementStrategy: log.placementStrategy };
  await prisma.publishLogRecord.create({
    data: {
      id: log.id,
      userId,
      draftId: log.draftId || null,
      status: log.status,
      message: log.message,
      metaJson: jsonEncode(Object.keys(meta).length ? meta : null),
    },
  });
  return log;
}
