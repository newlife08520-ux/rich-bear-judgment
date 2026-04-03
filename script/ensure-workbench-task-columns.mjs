/**
 * 確保 WorkbenchTask 表具備 20260307120000 新增的欄位。
 * 啟動前固定執行，並輸出完整檢查結果（current / missing / added / final columns）。
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const rawDbFile = process.env.DATABASE_URL?.replace(/^file:/, "") ?? path.join(rootDir, ".data", "workbench.db");
const dbPath = path.isAbsolute(rawDbFile) ? rawDbFile : path.resolve(rootDir, rawDbFile);

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
  console.log("[ensure-workbench-task-columns] DATABASE_URL (raw):", process.env.DATABASE_URL ?? "(未設，使用預設)");
  console.log("[ensure-workbench-task-columns] 實際 DB 路徑:", dbPath);
  console.log("[ensure-workbench-task-columns] 路徑存在?", fs.existsSync(dbPath));

  let db;
  try {
    db = new Database(dbPath, { readonly: false });
  } catch (e) {
    console.error("[ensure-workbench-task-columns] 無法開啟 DB:", e.message);
    console.error("[ensure-workbench-task-columns] 完整錯誤:", e);
    process.exit(1);
  }

  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='WorkbenchTask'").all();
  console.log("[ensure-workbench-task-columns] WorkbenchTask 表存在?", tableExists.length > 0);

  if (tableExists.length === 0) {
    console.error("[ensure-workbench-task-columns] 表不存在，無法補欄。請先執行 prisma migrate deploy。");
    db.close();
    process.exit(1);
  }

  const tableInfo = db.prepare('PRAGMA table_info("WorkbenchTask")').all();
  const currentColumns = tableInfo.map((r) => r.name);
  console.log("[ensure-workbench-task-columns] current columns:", currentColumns.join(", "));

  const existing = new Set(currentColumns);
  const missingColumns = COLUMNS.filter((c) => !existing.has(c.name)).map((c) => c.name);
  console.log("[ensure-workbench-task-columns] missing columns:", missingColumns.length ? missingColumns.join(", ") : "(無)");

  const addedColumns = [];
  for (const { name, sql } of COLUMNS) {
    if (existing.has(name)) continue;
    try {
      db.exec(sql);
      addedColumns.push(name);
      console.log("[ensure-workbench-task-columns] 已補上欄位:", name);
    } catch (e) {
      if (/duplicate column name/i.test(e.message)) {
        existing.add(name);
        continue;
      }
      console.error("[ensure-workbench-task-columns] 補欄失敗 column=", name, "error=", e.message);
      console.error("[ensure-workbench-task-columns] 完整錯誤:", e);
      db.close();
      process.exit(1);
    }
  }
  console.log("[ensure-workbench-task-columns] added columns (本次):", addedColumns.length ? addedColumns.join(", ") : "(無)");

  const finalInfo = db.prepare('PRAGMA table_info("WorkbenchTask")').all();
  const finalColumns = finalInfo.map((r) => r.name);
  console.log("[ensure-workbench-task-columns] final columns:", finalColumns.join(", "));

  db.close();
  console.log("[ensure-workbench-task-columns] 完成。本次補上", addedColumns.length, "個欄位。");
}

main();
