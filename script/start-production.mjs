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
  const stderr = (migrate.stderr || "").concat(migrate.stdout || "");
  const isP3009OrDuplicate = /P3009|duplicate column|failed migrations/i.test(stderr);
  if (isP3009OrDuplicate) {
    console.log("[start-production] 偵測到 P3009/duplicate column，執行 migrate resolve…");
    const resolve = spawnSync("npx", ["prisma", "migrate", "resolve", "--applied", "20260307120000_add_workbench_task_columns"], {
      cwd: rootDir,
      shell: true,
      encoding: "utf8",
    });
    if (resolve.stdout) process.stdout.write(resolve.stdout);
    if (resolve.stderr) process.stderr.write(resolve.stderr);
    if (resolve.status !== 0) {
      console.error("[start-production] migrate resolve 失敗，/api/workbench/tasks 可能仍 503");
    }
  } else {
    console.error("[start-production] prisma migrate deploy FAILED (exit code:", migrate.status, ")");
  }
}

console.log("[start-production] 執行 ensure-workbench-task-columns（不論 migrate 成敗皆執行）…");
const ensure = spawnSync(execPath, [path.join(rootDir, "script", "ensure-workbench-task-columns.mjs")], {
  cwd: rootDir,
  env: process.env,
  encoding: "utf8",
});
if (ensure.stdout) process.stdout.write(ensure.stdout);
if (ensure.stderr) process.stderr.write(ensure.stderr);
if (ensure.status !== 0) {
  console.error("[start-production] ensure-workbench-task-columns 執行失敗 exitCode=", ensure.status, "，/api/workbench/tasks 可能仍 503");
}

console.log("[start-production] Starting server: node dist/index.cjs");
const env = { ...process.env, NODE_ENV: "production" };
const server = spawnSync(execPath, [path.join(rootDir, "dist", "index.cjs")], {
  cwd: rootDir,
  env,
  stdio: "inherit",
});

process.exit(server.status ?? 1);
