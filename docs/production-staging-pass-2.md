# Production / Staging 驗收 — 第二輪（一致性審查 + 真實狀態）

## Phase 0：一致性審查（以 main branch 與 repo 為準）

### 0.1 main branch 現況（實際讀取結果）

**package.json scripts**
```json
"dev": "cross-env NODE_ENV=development tsx server/index.ts",
"build": "prisma generate && tsx script/build.ts",
"start": "node script/start-production.mjs",
"check": "tsc",
...
```

**script/build.ts 要點**
- 開頭：`execSync("npx prisma generate", { stdio: "inherit" })`
- 接著 `rm("dist")`、Vite client、esbuild server
- `external` = `[...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)]`（全部 package 皆 external，無 allowlist）

**server/static.ts 要點**
- `express.static(distPath)` 後為 SPA fallback
- fallback 為 `app.use((req, res, next) => { if (req.method !== "GET") return next(); if (req.path === "/health" || req.path.startsWith("/api/")) return next(); res.sendFile(...index.html); })`
- 未使用 `app.get("*", ...)`，故無 Express 5 path-to-regexp 裸 `*` 問題

**server/index.ts 要點**
- `await registerRoutes(httpServer, app)` 先執行
- 再 `app.use` 錯誤處理
- 再 `if (process.env.NODE_ENV === "production") serveStatic(app);`
- 故 **GET /health 在 registerRoutes 內註冊，順序早於 serveStatic**，理論上會由 server 直接回 JSON

**script/start-production.mjs**
- 存在；先 `npx prisma migrate deploy`，失敗時 log 並繼續
- 再 `spawnSync(execPath, [path.join(rootDir, "dist", "index.cjs")], { env: { ...process.env, NODE_ENV: "production" }, ... })`
- 無 shell 分隔符，跨平台

**server/routes.ts**
- `app.get("/health", ...)` 回 `res.status(200).json({ ok: true })`
- `app.get("/api/workbench/tasks", requireAuth, async (req, res) => { try { ... getWorkbenchTasks(...); res.json(tasks); } catch (err) { console.error("[GET /api/workbench/tasks]", err); res.status(500).json({ message: "...", error: ... }); } })`

**prisma/migrations**
- `20260306013101_init_workbench`：初版表
- `20260307120000_add_workbench_task_columns`：為 WorkbenchTask 加 draftId, reviewSessionId, taskSource, priority, dueDate, impactAmount, taskType

---

### 0.2 docs/production-staging-pass-1.md 描述 vs repo

| 項目 | pass-1 描述 | repo 實際 | 一致？ |
|------|-------------|-----------|--------|
| package.json start | 改為 `node script/start-production.mjs` | 確為 `"start": "node script/start-production.mjs"` | ✅ |
| start 是否用 `;` | 第 5 節寫「start 已用 `;` 讓 server 仍會起動」 | 已改為 mjs，migrate 失敗時在腳本內 log 後仍啟動，**未使用** `;` | ❌ 文件過時 |
| script/start-production.mjs | 執行 migrate deploy，失敗 log 再啟動 server | 與上述現況一致 | ✅ |
| static fallback | 改為 app.use middleware，排除 /health、/api | 與 static.ts 現況一致 | ✅ |
| GET /api/workbench/tasks | 加 try/catch、log、500 帶 message/error | 與 routes.ts 一致 | ✅ |
| migration 新增 | 20260307120000 補 WorkbenchTask 欄位 | 存在且內容相符 | ✅ |

---

### 0.3 文件／回報／repo／staging 不一致清單

1. **package.json / build / start 是否如回報所述**
   - **repo**：build = `prisma generate && tsx script/build.ts`，start = `node script/start-production.mjs`。
   - **一致**。pass-1 第 5 節「start 已用 `;`」為舊描述，應改為「由 script/start-production.mjs 在 migrate 失敗時 log 後仍啟動」。

2. **static fallback 是否已修**
   - **repo**：已改為 `app.use` middleware，排除 `/health` 與 `/api/*`，未使用 `app.get("*")`。
   - **一致**。

3. **/health 是否已由 server 直接回 JSON**
   - **repo**：`app.get("/health", ...)` 在 registerRoutes 內、早於 serveStatic，回 `res.status(200).json({ ok: true })`；static 的 fallback 也排除 `/health`。
   - **程式面一致**。**staging 未驗證**：無實際對 staging 打 GET /health 的回應截圖或 curl 結果，不能宣稱「staging 已回 JSON」。

4. **/api/workbench/tasks 500 是否已真正修掉**
   - **repo**：有 migration 補欄位、start 會跑 migrate deploy、tasks handler 有 try/catch 與 log。
   - **staging 未驗證**：無 staging 上 /api/workbench/tasks 回 200 的證據；若 DB 未成功套用 migration（例如 duplicate column 或 P3009），仍會 500。需 Railway logs 或實際請求結果才能確認。

5. **judgment 主流程是否真的已驗證**
   - **pass-1**：寫「需您驗證」。
   - **實際**：**未驗證**。無「送出內容 → 有回覆 → 結構化裁決卡顯示 → 一鍵轉任務不炸」的實測紀錄或截圖。

6. **staging 真實觀察結果**
   - **本輪無法取得**：未連線 Railway，無 logs、無實際請求結果。所有 staging 項目均標為**未驗證（需使用者／維運在 staging 執行並貼證據）**。

---

## 1. 完成狀態

| Phase | 狀態 | 說明 |
|-------|------|------|
| **Phase 0 一致性審查** | ✅ 已完成 | 已比對 main、pass-1、repo，並產出不一致清單。 |
| **Phase 1 production 真問題** | ⏸️ 待驗證 | repo 已具備 migration、try/catch、static、/health 註冊順序；**staging 是否仍 500／/health 是否回 JSON 需在 staging 驗證**。 |
| **Phase 2 啟動鏈與部署** | ✅ repo 已就緒 | start 已為 mjs、build 含 prisma generate、external 全 package。 |
| **Phase 3 體驗小修** | ⏸️ 未做 | 依指示在 Phase 1、2 完成並驗證後才做。 |
| **staging 驗證** | ❌ 未驗證 | 需在 Railway staging 實際打 /、/health、/tasks、/judgment、/publish、/settings 並記錄結果。 |

---

## 2. 文件／repo／staging 不一致清單（摘要）

- **pass-1 第 5 節**：「start 已用 `;`」→ 應改為「由 script/start-production.mjs 處理 migrate 失敗後仍啟動」。
- **staging**：/health、/api/workbench/tasks、judgment 主流程、一鍵轉任務、/publish、/settings 均**無貼上驗證證據**，不得寫成「已完成」或「已驗證」。

---

## 3. Production 問題根因（依 repo 與 pass-1 整理）

- **/api/workbench/tasks 500**：WorkbenchTask 表缺欄（draftId 等）或 migration 未在 production 套用（或套用失敗如 duplicate column / P3009）。解方在 repo 已做：補 migration、start 跑 migrate deploy、try/catch 與 log；**實際是否修掉需看 staging 與 Railway logs**。
- **/health**：若曾被 SPA 接走，原因為 static catch-all；repo 已改為 middleware 並排除 /health、/api。**是否仍被接走需在 staging 打 GET /health 確認。**
- **judgment**：依「設定」頁 AI API Key（Gemini），非環境變數；未設會回 400 NO_API_KEY。一鍵轉任務依 workbench tasks API；tasks 若仍 500，一鍵轉任務也會失敗。

---

## 4. 實際修改檔案（本輪）

| 檔案 | 修改目的 |
|------|----------|
| **docs/production-staging-pass-2.md** | 本文件：Phase 0 一致性審查、不一致清單、驗證狀態、Railway variables、給老闆摘要。 |

本輪**未改** package.json、script/build.ts、server/static.ts、server/index.ts、server/routes.ts、script/start-production.mjs、prisma migrations（僅依現況撰寫與 repo 一致之回報）。

---

## 5. 本機驗證結果

| 項目 | 結果 | 備註 |
|------|------|------|
| npm run build | ✅ 通過 | 依前輪紀錄；必要時可再跑一次確認。 |
| npm start 可執行 | ✅ 通過 | 前輪已驗：start-production.mjs 執行、migrate 失敗時 log 後仍啟動、server 監聽。 |
| GET /health 本機 | ✅ 通過 | 前輪本機打 http://localhost:PORT/health 回 `{"ok":true}`。 |
| GET /api/workbench/tasks 本機 | ⏸️ 需登入 | 未在本機 production 模式實測帶 session 的 /api/workbench/tasks。 |

---

## 6. Staging 驗證結果

**說明：以下皆無法由本端代為執行，需在 Railway staging 實際操作並貼結果。**

| 項目 | 狀態 | 備註 |
|------|------|------|
| / 可開 | 未驗證 | 需實際開啟 staging 首頁並記錄。 |
| GET /health 回 {"ok":true} | 未驗證 | 需直接對 staging 網址打 GET /health，貼回應 body 與 status。 |
| /tasks 可開且 tasks API 回 200 | 未驗證 | 需開 /tasks、看 network 中 /api/workbench/tasks 是否 200；若 500，請貼 Railway logs 中 `[GET /api/workbench/tasks]` 錯誤。 |
| /judgment 可開且送出有回覆 | 未驗證 | 需登入 → 設定頁設 AI API Key → 審判官頁送一則內容 → 確認有回覆與結構化裁決卡。 |
| 一鍵轉任務不炸 | 未驗證 | 在 judgment 回覆後按一鍵轉任務，確認不 500、任務列表可見。 |
| /publish 可開 | 未驗證 | 需實際開啟並記錄。 |
| /settings 可開 | 未驗證 | 需實際開啟並記錄。 |

---

## 7. 未完成與原因

| 項目 | 原因 |
|------|------|
| staging 全項驗證 | 無 Railway 存取權，無法代打 /health、/tasks、/judgment 等，需使用者或維運在 staging 執行並回報。 |
| /api/workbench/tasks 是否已 200 | 若 migration 在 staging 未成功（如 duplicate column、P3009），仍會 500；需 Railway logs 或 DB 狀態才能對症。 |
| judgment 主流程實測 | 需登入 + 設定 AI Key + 實際送出；未執行故列未驗證。 |
| Phase 3 體驗小修 | 依指示在 Phase 1、2 驗證通過後才做。 |

---

## 8. 風險清單

- **Staging 無驗證證據**：目前所有「staging 應可…」均為推論，非實測結果；若未補驗證，上線後可能仍出現 500／/health 非 JSON／judgment 不可用。
- **Migration 失敗情境**：若 DB 已存在新欄位（例如曾 db push），migrate deploy 可能失敗；start-production.mjs 會照常啟動，但若 DB 實際缺欄，tasks 仍會 500。
- **SESSION_SECRET**：production 未設則用預設，有安全風險。
- **judgment**：依設定頁 AI Key，未設則無法使用；需在文件中寫清操作路徑。

---

## 9. Railway 必要 Variables（建議）

| 變數 | 必填 | 說明 |
|------|------|------|
| NODE_ENV | 建議 | `production`（Railway 常自動設） |
| SESSION_SECRET | 建議 | 正式環境隨機長字串，勿用預設 |
| DATABASE_URL | 選填 | 不設則用預設 `file:./.data/workbench.db`；ephemeral 重 deploy 會清空 |
| （審判官 AI） | 非 env | 使用「設定」頁的 AI API Key（Gemini），非環境變數 |

其餘（Meta、GA4、mail、Stripe 等）依功能需求再列。

---

## 10. 給老闆的 10 點白話摘要

1. **這輪只做「對齊真實狀態」**：先比對 main、文件、回報，列出哪裡一致、哪裡不一致，沒有用文件掩蓋未驗證的項目。
2. **repo 現況**：build 有 prisma generate、start 用 Node 腳本跑 migrate 再起 server、/health 在 static 前註冊且 static 不接 /health、tasks API 有 try/catch 與 log、有補 WorkbenchTask 欄位的 migration。
3. **文件與 repo 一處不一致**：pass-1 寫「start 已用 `;`」應改為「由 start-production.mjs 處理」。
4. **staging 全部未驗證**：沒人貼過 staging 的 /health 回應、/tasks 是否 200、judgment 是否真的能送出一則並有回覆，所以不能寫「staging 已完成」。
5. **/api/workbench/tasks 500**：程式與 migration 都準備好了，但 staging 是否還 500 要看實際請求與 Railway logs；若仍 500，需從 logs 抓 `[GET /api/workbench/tasks]` 錯誤訊息。
6. **/health**：程式上應由 server 回 JSON；是否被 SPA 接走要在 staging 直接打 GET /health 確認。
7. **judgment**：要能用必須先在「設定」頁填 AI API Key；一鍵轉任務依 tasks API，tasks 修好才會正常。
8. **本輪沒有新功能、沒有改 Rich Bear 核心**：只做一致性審查與寫清楚「誰已落地、誰未驗證」。
9. **下一步**：在 staging 實際執行驗證清單（/、/health、/tasks、/judgment、/publish、/settings），每項寫「已驗證」或「卡住原因」並貼證據；若 tasks 仍 500，貼 Railway logs。
10. **commit**：本輪僅新增本文件；若之後修正 pass-1 過時描述或補程式，再另 commit 並在下方補記。

---

## 11. Commit hash 與對應修正項目

| Commit | 對應項目 |
|--------|----------|
| （本輪） | 僅新增 `docs/production-staging-pass-2.md`；**尚未 commit**。若你 commit 此檔，請將 hash 填於此。 |
| 725628b（前輪） | fix(start): script/start-production.mjs；static SPA fallback 改 app.use 排除 /health、/api |

---

---

## 最終回報（輸出格式 1–8）

### 1. 完成狀態

- **Phase 0 一致性審查**：已完成；已產出「文件／repo／staging 不一致清單」。
- **Phase 1（production 真問題）**：repo 端修正已就緒；**staging 是否已修掉 500／/health 是否回 JSON：未驗證**。
- **Phase 2（啟動鏈與部署）**：repo 已就緒（start mjs、build、external）；無需本輪再改。
- **Phase 3（體驗小修）**：未做（依指示在 1、2 驗證後才做）。
- **Staging 驗證**：**全部未驗證**；需在 Railway 實際執行並貼結果。

### 2. 已完成項目

- 比對 main branch 的 package.json、script/build.ts、server/static.ts、server/index.ts、routes（/health、/api/workbench/tasks）、start-production.mjs、migrations。
- 撰寫「文件／repo／staging 不一致清單」並寫入 pass-2。
- 修正 pass-1 過時描述（「start 已用 `;`」→「由 script/start-production.mjs 處理」）。
- 列出 Railway 必要 variables、本機驗證狀態、staging 未驗證項目與風險。

### 3. 實際修改檔案

| 檔案 | 修改目的 |
|------|----------|
| docs/production-staging-pass-2.md | 新增：Phase 0 一致性審查、不一致清單、驗證結果、風險、給老闆 10 點、最終回報 1–8。 |
| docs/production-staging-pass-1.md | 修正一處過時描述：migrate 失敗時改為「由 start-production.mjs … 仍啟動」，不再寫「已用 `;`」。 |

### 4. 驗證結果

- **本機**：npm run build 通過（依前輪）、npm start 可執行、本機 GET /health 回 `{"ok":true}`（前輪已驗）。本輪未再跑 build/start。
- **Staging**：/、/health、/tasks、/judgment、/publish、/settings **均未驗證**；需在 staging 實際操作並貼證據。

### 5. 未完成與原因

- **Staging 全項**：無 Railway 存取，無法代為驗證；需使用者或維運執行並回報。
- **/api/workbench/tasks 是否已 200**：取決於 staging DB 是否成功套用 migration；若仍 500 需從 Railway logs 抓 `[GET /api/workbench/tasks]` 錯誤。
- **judgment 主流程**：需登入 + 設定頁填 AI Key + 送出 + 一鍵轉任務；未執行故未驗證。
- **Phase 3**：依指示在 Phase 1、2 驗證通過後才做。

### 6. 風險

- 所有「staging 應可…」均為推論，無實測證據；未補驗證就上線可能仍有 500／/health 非 JSON／judgment 不可用。
- Migration 在 staging 可能失敗（duplicate column／P3009），server 仍會起動但 tasks 可能仍 500。
- SESSION_SECRET 未設則用預設，有安全風險。
- 管理功能無後端 role 保護，僅前端收斂（與前輪報告一致）。

### 7. 下一步建議

1. 在 **staging** 依驗證清單執行：GET /health、開 /tasks 看 API 是否 200、開 /judgment 設 AI Key 後送一則並一鍵轉任務、開 /publish、/settings。
2. 每項記錄「已驗證通過」或「卡住原因」；若 tasks 仍 500，貼 Railway 的 `[GET /api/workbench/tasks]` 錯誤。
3. 將結果回填至 pass-2 的「Staging 驗證結果」表，並視需要再修程式或 DB／migration。
4. 通過後再進行 Phase 3 低風險體驗小修。

### 8. Commit hash

- **本輪**：**bdad01b** — 新增 production-staging-pass-2.md（Phase 0 一致性審查、不一致清單、驗證結果、最終回報 1–8）、修正 production-staging-pass-1.md 過時描述（start 改由 mjs 處理）。
- **前輪相關**：725628b（start-production.mjs、static fallback）
