/**
 * Prisma / pg 僅接受 postgresql:// 或 postgres://。
 * Railway 若誤留舊文件 DATABASE_URL=file:...，會觸發 P1013；可改設 PRISMA_DATABASE_URL 指向 Postgres 插件連線字串。
 */
export function resolvePostgresDatabaseUrl(): string {
  const candidates = [
    process.env.PRISMA_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
  ];

  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const u = raw.trim();
    if (u.startsWith("postgresql://") || u.startsWith("postgres://")) {
      return u;
    }
  }

  const legacy = process.env.DATABASE_URL?.trim();
  if (legacy?.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL 為 SQLite（file:…），與本專案 Prisma provider=postgresql 不相容。\n" +
        "請在 Railway：刪除 Web 服務中覆寫的 DATABASE_URL=file:…，改為引用 Postgres 服務提供的 DATABASE_URL；\n" +
        "或保留 file: 供其他用途時，另設 PRISMA_DATABASE_URL=postgresql://…（複製自 Postgres 插件的連線字串）。"
    );
  }

  if (!legacy) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "生產環境必須設定 DATABASE_URL 或 PRISMA_DATABASE_URL（須為 postgresql:// 或 postgres://）。"
      );
    }
    return "postgresql://postgres:postgres@localhost:5432/richbear?schema=public";
  }

  throw new Error(
    `DATABASE_URL 必須以 postgresql:// 或 postgres:// 開頭。目前開頭：${legacy.slice(0, 32)}…`
  );
}
