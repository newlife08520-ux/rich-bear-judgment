/**
 * P2 一次性遷移：將 .data 內 workbench 相關 JSON 匯入 SQLite（Prisma）
 * 執行：npx tsx script/import-workbench-json-to-db.ts
 */
import path from "path";
import fs from "fs";
import { prisma } from "../server/db";

const DATA_DIR = path.join(process.cwd(), ".data");
const OWNERS_FILE = path.join(DATA_DIR, "workbench-owners.json");
const TASKS_FILE = path.join(DATA_DIR, "workbench-tasks.json");
const AUDIT_FILE = path.join(DATA_DIR, "workbench-audit.json");
const MAPPING_FILE = path.join(DATA_DIR, "workbench-mapping.json");

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
    }
  } catch (e) {
    console.error(`[Import] Failed to load ${filePath}:`, (e as Error).message);
  }
  return fallback;
}

async function main() {
  console.log("[Import] Starting workbench JSON → SQLite import...");

  const owners = loadJson<Record<string, { productOwnerId: string; mediaOwnerId: string; creativeOwnerId: string; taskStatus: string }>>(OWNERS_FILE, {});
  for (const [productName, o] of Object.entries(owners)) {
    await prisma.workbenchOwner.upsert({
      where: { productName },
      create: {
        productName,
        productOwnerId: o.productOwnerId ?? "",
        mediaOwnerId: o.mediaOwnerId ?? "",
        creativeOwnerId: o.creativeOwnerId ?? "",
        taskStatus: o.taskStatus ?? "unassigned",
      },
      update: {
        productOwnerId: o.productOwnerId ?? "",
        mediaOwnerId: o.mediaOwnerId ?? "",
        creativeOwnerId: o.creativeOwnerId ?? "",
        taskStatus: o.taskStatus ?? "unassigned",
      },
    });
  }
  console.log(`[Import] Owners: ${Object.keys(owners).length} rows`);

  const tasks = loadJson<Array<{ productName?: string; creativeId?: string; title: string; action: string; reason: string; assigneeId?: string | null; status: string; createdBy: string; notes?: string }>>(TASKS_FILE, []);
  for (const t of tasks) {
    await prisma.workbenchTask.create({
      data: {
        productName: t.productName ?? null,
        creativeId: t.creativeId ?? null,
        title: t.title,
        action: t.action,
        reason: t.reason,
        assigneeId: t.assigneeId ?? null,
        status: t.status ?? "unassigned",
        createdBy: t.createdBy,
        notes: t.notes ?? "",
      },
    });
  }
  console.log(`[Import] Tasks: ${tasks.length} rows`);

  const auditEntries = loadJson<Array<{ userId: string; entityType: string; entityId: string; action: string; oldValue?: unknown; newValue?: unknown }>>(AUDIT_FILE, []);
  for (const a of auditEntries.slice(-500)) {
    await prisma.workbenchAudit.create({
      data: {
        userId: a.userId,
        entityType: a.entityType,
        entityId: a.entityId,
        action: a.action,
        oldValue: a.oldValue != null ? JSON.stringify(a.oldValue) : null,
        newValue: a.newValue != null ? JSON.stringify(a.newValue) : null,
      },
    });
  }
  console.log(`[Import] Audit: ${Math.min(auditEntries.length, 500)} rows`);

  const mapping = loadJson<Record<string, string>>(MAPPING_FILE, {});
  for (const [entityId, productName] of Object.entries(mapping)) {
    await prisma.workbenchMapping.upsert({
      where: { entityType_entityId: { entityType: "campaign", entityId } },
      create: { entityType: "campaign", entityId, productName },
      update: { productName },
    });
  }
  console.log(`[Import] Mapping: ${Object.keys(mapping).length} rows`);

  console.log("[Import] Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
