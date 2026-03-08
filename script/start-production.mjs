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
  stdio: "inherit",
  shell: true,
});

if (migrate.status !== 0) {
  console.error("[start-production] prisma migrate deploy failed (status:", migrate.status, "). Starting server anyway.");
}

console.log("[start-production] Starting server: node dist/index.cjs");
const env = { ...process.env, NODE_ENV: "production" };
const server = spawnSync(execPath, [path.join(rootDir, "dist", "index.cjs")], {
  cwd: rootDir,
  env,
  stdio: "inherit",
});

process.exit(server.status ?? 1);
