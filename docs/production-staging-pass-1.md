# Production / Staging 驗收缺口修復 — 第一輪

## 1. 問題清單

| # | 問題 | 現象 |
|---|------|------|
| 1 | **/api/workbench/tasks 在 production 回 500** | /tasks 頁面可開但列表載入失敗，API 回 Internal Server Error。 |
| 2 | **/health 被前端 SPA 接走** | GET /health 回 404 或 HTML（index.html），而非 `{"ok":true}`。 |
| 3 | **judgment 主流程待驗證** | 需確認 production 審判官提交、結構化裁決卡、一鍵轉任務是否正常，及缺哪些環境變數。 |

---

## 2. 根因

### 2.1 /api/workbench/tasks 500

- **DB schema 與 migration 不同步**：Prisma schema 的 `WorkbenchTask` 已有 `draftId`、`reviewSessionId`、`taskSource`、`priority`、`dueDate`、`impactAmount`、`taskType`，但既有 migration（`20260306013101_init_workbench`）未包含這些欄位。production 若只跑過該次 migrate，表結構缺欄，`prisma.workbenchTask.findMany()` 會丟錯導致 500。
- **production 未保證跑 migrate**：Start 未執行 `prisma migrate deploy`，新 deploy 的 DB 可能從未建表或從未套用新欄位。

### 2.2 /health 被 SPA 接走

- **Static 的 catch-all 吃掉 /health**：`server/static.ts` 使用 `app.use("/{*path}", ...)` 回傳 index.html，在部分情境下會先於 `app.get("/health", ...)` 匹配到 GET /health，導致回傳 HTML 而非 JSON。
- **Route 註冊順序**：雖理論上 registerRoutes 先註冊 /health，再註冊 serveStatic，但 catch-all 寫法仍可能讓 /health 被當成 SPA 路徑處理。

### 2.3 judgment 主流程

- **API Key 來自「設定」頁**：審判官使用 `storage.getSettings(userId).aiApiKey`，非環境變數；production 需有使用者登入並在設定頁填寫 Gemini API Key 才能送出判讀。
- **SESSION_SECRET**：Session 使用 `process.env.SESSION_SECRET || "dev-secret-key-marketing-judge"`；production 建議設 `SESSION_SECRET`，否則沿用預設有安全風險。

---

## 3. 實際修改檔案

| 檔案 | 修改目的 |
|------|----------|
| **package.json** | `start` 改為 `node script/start-production.mjs`，由 Node 腳本依序執行 migrate deploy 與啟動 server，跨平台（Windows / Linux）。 |
| **script/start-production.mjs** | 新增：執行 `npx prisma migrate deploy`，失敗時 log 並繼續啟動 `node dist/index.cjs`。 |
| **prisma/migrations/20260307120000_add_workbench_task_columns/migration.sql** | 新增 migration：為 `WorkbenchTask` 補上 `draftId`、`reviewSessionId`、`taskSource`、`priority`、`dueDate`、`impactAmount`、`taskType`。 |
| **server/routes.ts** | `GET /api/workbench/tasks` 加上 try/catch，回傳 500 時帶 `message` 與 `error`，並 log，方便從 Railway logs 對症。 |
| **server/static.ts** | 將 SPA fallback 改為 `app.use((req, res, next) => ...)`，僅對 GET 且路徑**不是** `/health`、**不是** `/api/*` 時回傳 index.html；避免 /health 被接走，且避免 Express 5 不支援 `app.get("*")` 的 PathError。 |

---

## 4. 驗證結果

| 項目 | 狀態 | 說明 |
|------|------|------|
| **本機 build** | ✅ 通過 | 已執行 `npm run build`，exit code 0。 |
| **production /api/workbench/tasks** | ⏳ 需您驗證 | 請重新 deploy 後開 /tasks，確認列表載入、API 回 200；若仍 500，請從 Railway logs 看 `[GET /api/workbench/tasks]` 的 error 訊息。 |
| **production /health** | ⏳ 需您驗證 | 請對 staging 網址直接 GET `/health`，應回 200 與 `{"ok":true}`。 |
| **production judgment** | ⏳ 需您驗證 | 登入後到設定頁設定 AI API Key，再到審判官頁提交一則簡單內容，確認有回覆、結構化裁決卡顯示、一鍵轉任務不炸。 |

---

## 5. 尚未完成與原因

| 項目 | 原因 |
|------|------|
| **production 實機驗證** | 需在 staging 網址實際打 /tasks、/health、judgment，本端無法代為操作。 |
| **migrate 已存在欄位時** | 若 production DB 曾用 `prisma db push` 已含新欄位，`prisma migrate deploy` 可能因「欄位已存在」失敗；start 已用 `;` 讓 server 仍會起動，必要時可手動 `prisma migrate resolve` 或略過該次 migration。 |
| **judgment 依使用者設定** | 審判官需使用者在「設定」頁填寫 AI API Key，非僅靠環境變數；若未填會回 400 NO_API_KEY。 |

---

## 6. 環境變數與 judgment 需求（供 production 對照）

- **SESSION_SECRET**（建議必設）：正式環境請設隨機長字串，否則 session 沿用預設 key 有風險。
- **DATABASE_URL**（選填）：不設則用預設 `file:./.data/workbench.db`；Railway  ephemeral 重 deploy 會清空，若要持久需 Volume 或 PostgreSQL。
- **審判官 AI 回覆**：依「設定」頁的 **AI API Key**（Gemini），非環境變數；未設定時會回「尚未設定 AI API Key」。

---

## 7. 明天給老闆的白話摘要

1. **tasks 500 已從根因修**：補了缺少的 DB 欄位 migration，且 start 時會跑 `prisma migrate deploy`，讓 production 表結構與程式一致；並對 tasks API 加 try/catch 與錯誤訊息，方便看 log 除錯。
2. **/health 不再被 SPA 吃掉**：SPA fallback 改為明確排除 `/health` 與 `/api/*`，GET /health 應可穩定回 `{"ok":true}`，供平台或 LB 檢查。
3. **judgment 要能用需先設 API Key**：在「設定」頁填好 Gemini API Key 後，審判官才能送出並得到回覆；一鍵轉任務依現有 workbench tasks API，tasks 修好後應可正常。
4. **請再 deploy 一次**：改動需重新 build/deploy 後才會在 staging 生效。
5. **若 tasks 仍 500**：到 Railway 看 Deploy/Runtime logs，搜尋 `[GET /api/workbench/tasks]` 的錯誤內容，再對症處理（例如 DB 權限、路徑、migrate 狀態）。
6. **若 /health 仍不對**：確認請求是直接打到「網址/health」且為 GET；若透過前端 router 會拿到 SPA 的 404。
7. **正式上線前**：建議設好 `SESSION_SECRET`；若需持久化 DB，再規劃 PostgreSQL 或 Volume。
8. **本輪沒動**：未擴功能、未大改 UI、未改 Rich Bear 核心人格，僅修 production 驗收缺口與文件。
