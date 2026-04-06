# 部署說明

## 環境變數

- **DATABASE_URL**：PostgreSQL 連線字串（須以 `postgresql://` 或 `postgres://` 開頭）。本機可參考 `.env.example`。
- **PRISMA_DATABASE_URL**（選用）：若平台誤將 `DATABASE_URL` 設成舊版 SQLite（`file:…`），可另設本變數為 Postgres 連線字串；Prisma 與 `server/db.ts` 會**優先**使用本值。
- **切勿**在生產環境把 `DATABASE_URL` 設為 `file:/app/data/workbench.db` 等 SQLite 路徑：本專案 `schema.prisma` 的 provider 為 **postgresql**，否則 `prisma migrate deploy` 會報 **P1013**。
- **SESSION_SECRET**：生產環境請設強隨機字串。
- 其餘 Meta／GA4／Gemini 等金鑰依既有 `README` 或營運文件設定。

## 資料庫

1. 安裝並啟動 PostgreSQL（或使用雲端託管）。
2. 套用遷移：

   ```bash
   npx prisma migrate deploy
   ```

3. **預設帳號**：`admin` / `admin123`、`manager` / `manager123`、`user` / `user123`。

   - **生產啟動**（`npm run start` → `script/start-production.mjs`）：在 `prisma migrate deploy` **成功後**會自動執行 **`node script/seed-default-users.mjs`**（不需 `tsx`）。若該三組帳號不存在會建立；若 `passwordHash` 為空或不是 bcrypt，會**自動修復**，避免 Railway 上「永遠帳密錯誤」。
   - 手動種子：`npm run seed`（同上 mjs）。

   若三組帳號已有**有效 bcrypt** 但忘記密碼，請在 Railway 變數設 **`SEED_DEFAULT_USERS_ON_BOOT=1`** 後重新部署一次，會**強制**把三組密碼重設為上列預設值（成功後建議關閉此變數，否則每次部署都會重設）。

## 建置與啟動

```bash
npm ci
npm run build
npm run start
```

開發模式：`npm run dev`（需已設定 `DATABASE_URL`）。

## 媒體處理（ffmpeg）

素材轉檔／影片處理依賴系統內的 **ffmpeg**。若部署環境未預裝，請在映像或 Nixpacks 中一併安裝（見專案根目錄 `nixpacks.toml`）。

## 健康檢查

依平台設定 HTTP 探針指向應用程式監聽埠（預設與 `PORT` 環境變數一致）。
