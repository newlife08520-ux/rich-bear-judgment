# 部署說明

## 環境變數

- **DATABASE_URL**：PostgreSQL 連線字串（須含 `schema=public` 若使用非預設 schema）。本機可參考 `.env.example`。
- **SESSION_SECRET**：生產環境請設強隨機字串。
- 其餘 Meta／GA4／Gemini 等金鑰依既有 `README` 或營運文件設定。

## 資料庫

1. 安裝並啟動 PostgreSQL（或使用雲端託管）。
2. 套用遷移：

   ```bash
   npx prisma migrate deploy
   ```

3. （選用）種子帳號：

   ```bash
   npm run seed
   ```

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
