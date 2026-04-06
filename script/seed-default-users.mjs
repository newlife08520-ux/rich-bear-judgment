/**
 * 預設帳號種子：純 Node（不需 tsx），供 Railway / production 啟動與 npm run seed 使用。
 * - 缺帳號則建立；passwordHash 空或非 bcrypt 則自動重寫（修復舊庫無法登入）。
 * - SEED_DEFAULT_USERS_ON_BOOT=1 時強制重設 admin / manager / user 三組密碼為預設值。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function loadDotenvFromProjectRoot() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function resolvePostgresDatabaseUrl() {
  const candidates = [
    process.env.PRISMA_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
  ];
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const u = raw.trim();
    if (u.startsWith("postgresql://") || u.startsWith("postgres://")) return u;
  }
  const legacy = process.env.DATABASE_URL?.trim();
  if (legacy?.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL 為 SQLite（file:…），與 postgresql provider 不相容；請設 PRISMA_DATABASE_URL 或正確的 Postgres URL。"
    );
  }
  if (!legacy) {
    throw new Error("未設定 DATABASE_URL / PRISMA_DATABASE_URL（須為 postgresql:// 或 postgres://）。");
  }
  throw new Error(`DATABASE_URL 必須以 postgresql:// 開頭。目前：${legacy.slice(0, 32)}…`);
}

const ROUNDS = 12;
async function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

function isBcryptHash(h) {
  const s = (h || "").trim();
  return s.startsWith("$2a$") || s.startsWith("$2b$") || s.startsWith("$2y$");
}

const DEFAULT_USERS = [
  { id: "1", username: "admin", password: "admin123", role: "admin", displayName: "系統管理員" },
  { id: "2", username: "manager", password: "manager123", role: "manager", displayName: "行銷總監" },
  { id: "3", username: "user", password: "user123", role: "user", displayName: "行銷專員" },
];

async function main() {
  loadDotenvFromProjectRoot();
  const forceBoot = process.env.SEED_DEFAULT_USERS_ON_BOOT === "1";
  const connectionString = resolvePostgresDatabaseUrl();
  const adapter = new PrismaPg(connectionString);
  const prisma = new PrismaClient({ adapter });

  try {
    for (const u of DEFAULT_USERS) {
      const passwordHash = await hashPassword(u.password);
      const existing = await prisma.user.findFirst({
        where: { username: { equals: u.username, mode: "insensitive" } },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            id: u.id,
            username: u.username,
            passwordHash,
            role: u.role,
            displayName: u.displayName,
          },
        });
        console.log(`[seed-default-users] 已建立：${u.username}`);
        continue;
      }

      const needsRepair = !isBcryptHash(existing.passwordHash);
      if (forceBoot || needsRepair) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            role: u.role,
            displayName: u.displayName,
          },
        });
        console.log(
          `[seed-default-users] 已更新：${u.username}（${forceBoot ? "SEED_DEFAULT_USERS_ON_BOOT=1" : "修復無效／空 passwordHash"}）`
        );
      } else {
        console.log(`[seed-default-users] 略過（已有有效 bcrypt）：${u.username}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[seed-default-users]", e);
  process.exit(1);
});
