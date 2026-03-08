/**
 * Production 啟動腳本：先執行 prisma migrate deploy，再啟動 dist/index.cjs
 * 跨平台（Windows / Linux），不依賴 shell 分隔符。
 */
import { spawnSync } from "child_process";
import { execPath } from "process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

console.log("[start-production] Running prisma migrate deploy...");
const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: rootDir,
  shell: true,
  encoding: "utf8",
});
if (migrate.stdout) process.stdout.write(migrate.stdout);
if (migrate.stderr) process.stderr.write(migrate.stderr);

if (migrate.status !== 0) {
  console.error("[start-production] prisma migrate deploy FAILED (exit code:", migrate.status, ")");
  console.error("[start-production] 若為 duplicate column，可於 DB 手動執行 prisma migrate resolve --applied 20260307120000_add_workbench_task_columns 後重 deploy");
  console.error("[start-production] 仍將啟動 server，但 /api/workbench/tasks 可能 500，請檢查 DB 與 migration 狀態。");
}

console.log("[start-production] Starting server: node dist/index.cjs");
const env = { ...process.env, NODE_ENV: "production" };
const server = spawnSync(execPath, [path.join(rootDir, "dist", "index.cjs")], {
  cwd: rootDir,
  env,
  stdio: "inherit",
});

process.exit(server.status ?? 1);
