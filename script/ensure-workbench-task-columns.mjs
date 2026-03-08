/**
 * 確保 WorkbenchTask 表具備 20260307120000 新增的欄位（draftId, reviewSessionId, taskSource, priority, dueDate, impactAmount, taskType）。
 * 僅在欄位不存在時 ADD COLUMN，避免 duplicate column。
 * 供 start-production 在 migrate deploy 失敗（如 P3009）後呼叫，補齊欄位使 /api/workbench/tasks 可正常查詢。
 */
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const dbFile = process.env.DATABASE_URL?.replace(/^file:/, "") ?? path.join(rootDir, ".data", "workbench.db");
const dbPath = path.isAbsolute(dbFile) ? dbFile : path.resolve(rootDir, dbFile);

const COLUMNS = [
  { name: "draftId", sql: 'ALTER TABLE "WorkbenchTask" ADD COLUMN "draftId" TEXT' },
  { name: "reviewSessionId", sql: 'ALTER TABLE "WorkbenchTask" ADD COLUMN "reviewSessionId" TEXT' },
  { name: "taskSource", sql: 'ALTER TABLE "WorkbenchTask" ADD COLUMN "taskSource" TEXT' },
  { name: "priority", sql: 'ALTER TABLE "WorkbenchTask" ADD COLUMN "priority" TEXT' },
  { name: "dueDate", sql: 'ALTER TABLE "WorkbenchTask" ADD COLUMN "dueDate" DATETIME' },
  { name: "impactAmount", sql: 'ALTER TABLE "WorkbenchTask" ADD COLUMN "impactAmount" TEXT' },
  { name: "taskType", sql: 'ALTER TABLE "WorkbenchTask" ADD COLUMN "taskType" TEXT' },
];

function main() {
  let db;
  try {
    db = new Database(dbPath, { readonly: false });
  } catch (e) {
    console.error("[ensure-workbench-task-columns] Cannot open DB:", dbPath, e.message);
    process.exit(1);
  }

  const tableInfo = db.prepare('PRAGMA table_info("WorkbenchTask")').all();
  const existing = new Set(tableInfo.map((r) => r.name));

  const alreadyThere = COLUMNS.filter((c) => existing.has(c.name)).map((c) => c.name);
  const toAdd = COLUMNS.filter((c) => !existing.has(c.name));

  console.log("[ensure-workbench-task-columns] DB:", dbPath);
  if (alreadyThere.length > 0) {
    console.log("[ensure-workbench-task-columns] 已存在欄位:", alreadyThere.join(", "));
  }
  if (toAdd.length === 0) {
    console.log("[ensure-workbench-task-columns] 無需補欄，共 " + COLUMNS.length + " 欄位皆已存在。");
    db.close();
    return;
  }
  console.log("[ensure-workbench-task-columns] 待補欄位:", toAdd.map((c) => c.name).join(", "));

  let added = 0;
  for (const { name, sql } of toAdd) {
    try {
      db.exec(sql);
      console.log("[ensure-workbench-task-columns] 已補上欄位:", name);
      added++;
    } catch (e) {
      if (/duplicate column name/i.test(e.message)) {
        console.log("[ensure-workbench-task-columns] 欄位已存在（略過）:", name);
        continue;
      }
      console.error("[ensure-workbench-task-columns] 補欄失敗 column=", name, "error=", e.message);
      console.error("[ensure-workbench-task-columns] 完整錯誤:", e);
      db.close();
      process.exit(1);
    }
  }

  db.close();
  console.log("[ensure-workbench-task-columns] 完成。本次補上 " + added + " 個欄位。");
}

main();
