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

3. **首次部署必做**：種子預設帳號（`admin` / `admin123`、`manager` / `manager123`、`user` / `user123`）。若資料庫裡沒有有效 `passwordHash`，登入會一律回「帳號或密碼錯誤」。

   ```bash
   npm run seed
   ```

   種子會依 **username** upsert，並**每次覆寫**該三組帳號的 `passwordHash`（修復舊版 `update: {}` 種子留下的空雜湊）。若你忘記密碼，可再執行一次 `npm run seed` 還原為上列預設密碼。

   Railway 單次執行：`railway run npm run seed`（需已設定正確的 `DATABASE_URL`）。

   或設環境變數 **`SEED_DEFAULT_USERS_ON_BOOT=1`**，在 `migrate deploy` 成功後自動跑一次種子（建議僅第一次開通或修復密碼時開啟；長期開啟會在每次部署時把三個預設帳密重設為預設值）。

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
