/**
 * 從 .data/publish-drafts.json 與 .data/publish-logs.json 匯入至 Prisma PublishDraftRecord / PublishLogRecord
 * 使用方式：tsx script/backfill-publish-json-to-db.ts
 */
import * as fs from "fs";
import * as path from "path";
import { prisma } from "../server/db";

const DATA_DIR = path.join(process.cwd(), ".data");
const DRAFTS_FILE = path.join(DATA_DIR, "publish-drafts.json");
const LOGS_FILE = path.join(DATA_DIR, "publish-logs.json");

type DraftsStore = Record<string, Array<Record<string, unknown>>>;
type LogsStore = Record<string, Array<Record<string, unknown>>>;

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as T;
    }
  } catch (e) {
    console.error("[backfill] read failed:", filePath, (e as Error).message);
  }
  return fallback;
}

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeStr(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : null;
}

async function main() {
  const draftsStore = loadJson<DraftsStore>(DRAFTS_FILE, {});
  const logsStore = loadJson<LogsStore>(LOGS_FILE, {});

  let draftCount = 0;
  let logCount = 0;

  for (const [userId, drafts] of Object.entries(draftsStore)) {
    if (!Array.isArray(drafts)) continue;
    for (const d of drafts) {
      const id = String(d.id ?? "").trim();
      if (!id) continue;
      try {
        await prisma.publishDraftRecord.upsert({
          where: { id },
          create: {
            id,
            userId,
            batchId: safeStr(d.batchId),
            accountId: String(d.accountId ?? ""),
            pageId: safeStr(d.pageId),
            igAccountId: safeStr(d.igAccountId),
            campaignObjective: String(d.campaignObjective ?? ""),
            campaignName: String(d.campaignName ?? ""),
            adSetName: String(d.adSetName ?? ""),
            adName: String(d.adName ?? ""),
            budgetDaily: safeNum(d.budgetDaily),
            budgetTotal: safeNum(d.budgetTotal),
            scheduleStart: safeStr(d.scheduleStart),
            scheduleEnd: safeStr(d.scheduleEnd),
            audienceStrategy: String(d.audienceStrategy ?? ""),
            placementStrategy: String(d.placementStrategy ?? ""),
            assetPackageId: safeStr(d.assetPackageId),
            selectedVersionIdsJson: Array.isArray(d.selectedVersionIds)
              ? JSON.stringify(d.selectedVersionIds)
              : null,
            assetIdsJson: Array.isArray(d.assetIds) ? JSON.stringify(d.assetIds) : null,
            primaryCopy: safeStr(d.primaryCopy),
            headline: safeStr(d.headline),
            note: safeStr(d.note),
            cta: safeStr(d.cta),
            landingPageUrl: safeStr(d.landingPageUrl),
            status: String(d.status ?? "draft"),
            createdAt: d.createdAt ? new Date(String(d.createdAt)) : new Date(),
            updatedAt: d.updatedAt ? new Date(String(d.updatedAt)) : new Date(),
          },
          update: {},
        });
        draftCount++;
      } catch (e) {
        console.error("[backfill] draft upsert error:", id, (e as Error).message);
      }
    }
  }

  for (const [userId, logs] of Object.entries(logsStore)) {
    if (!Array.isArray(logs)) continue;
    for (const log of logs) {
      const id = String(log.id ?? "").trim();
      if (!id) continue;
      try {
        await prisma.publishLogRecord.upsert({
          where: { id },
          create: {
            id,
            userId,
            draftId: safeStr(log.draftId),
            status: String(log.status ?? ""),
            message: String(log.message ?? ""),
            metaJson: log.name ?? log.accountId ? JSON.stringify({ name: log.name, accountId: log.accountId }) : null,
          },
          update: {},
        });
        logCount++;
      } catch (e) {
        console.error("[backfill] log upsert error:", id, (e as Error).message);
      }
    }
  }

  console.log("[backfill] done. drafts:", draftCount, "logs:", logCount);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
