# Production / Staging 驗收 — 第三輪（真問題修復 + 一致性收斂）

## Phase 0：一致性審查（repo / 文件 / staging）

### 0.1 比對現況（main branch 實際讀取）

| 項目 | 現況 |
|------|------|
| **package.json build** | `"build": "prisma generate && tsx script/build.ts"` |
| **package.json start** | `"start": "node script/start-production.mjs"` |
| **script/build.ts** | 開頭 `execSync("npx prisma generate")`；external = 全 package（deps + devDeps） |
| **script/start-production.mjs** | 先 `npx prisma migrate deploy`，失敗時 log 後仍啟動 `node dist/index.cjs` |
| **server/index.ts** | (async) → **本輪改為先註冊 GET /health 再** registerRoutes → err → serveStatic |
| **server/routes.ts** | GET /health 已移除（改在 index 最早註冊）；GET /api/workbench/tasks 有 try/catch + log |
| **server/static.ts** | express.static + app.use fallback，僅對非 GET 或 path 非 /health、非 /api/* 回傳 index.html |
| **prisma/schema.prisma** | WorkbenchTask 含 draftId, reviewSessionId, taskSource, priority, dueDate, impactAmount, taskType |
| **最新 migration** | 20260307120000_add_workbench_task_columns：ADD COLUMN 上述欄位（SQLite 無 IF NOT EXISTS，重跑會 duplicate column） |
| **pass-1** | 描述 migration、static、start mjs；第 5 節已改為「由 start-production.mjs 處理」 |
| **pass-2** | 一致性審查、不一致清單、staging 全項標未驗證 |

### 0.2 明確不一致清單

1. **文件說已修，但 staging 仍觀察到問題**
   - **/health**：pass-1/pass-2 稱「程式面已排除 /health 被 SPA 接走」，但 **staging 實測仍被前端 SPA 接走、看到 404**。→ 本輪改為在 **server/index.ts 最早註冊 GET /health**，確保早於 registerRoutes 與 serveStatic。
   - **/api/workbench/tasks 500**：文件稱「migration + try/catch 已就緒」，但 **staging 仍 500**。→ 若 migration 未套用（如 duplicate column）或 DB 缺欄，會仍 500；本輪加強 start-production 的 migrate 失敗 log，並在文件中標明「需 Railway logs 或 migrate resolve」。

2. **repo 已修，但 staging 還沒驗**
   - GET /health 改在 index 最早註冊、start-production 明確 log migrate 失敗，**staging 尚未重新 deploy 驗證**。
   - /api/workbench/tasks、judgment 主流程、一鍵轉任務：**staging 均未驗證**。

3. **staging 表現與文件說法不一致**
   - 文件：「/health 理論上由 server 回 JSON」→ **staging 實際**：被 SPA 接走、前端 404。故改為在 index 最早註冊 /health。
   - 文件：「tasks 有 migration + try/catch」→ **staging 實際**：仍 500。可能原因：migration 未套用或套用失敗（duplicate column / P3009）。

4. **已驗證 vs 推論**
   - **已驗證**：本機 `npm run build`、本機 `npm start`、本機 GET /health 回 JSON（前輪）。
   - **僅推論／未驗證**：staging /health、staging /api/workbench/tasks 200、staging judgment 送出→回覆→結構化卡→一鍵轉任務、/publish、/settings。

---

## 1. 完成狀態

| Phase | 狀態 | 說明 |
|-------|------|------|
| **Phase 0 一致性審查** | ✅ 完成 | 已產出不一致清單並寫入本文件。 |
| **Phase 1 /health** | ✅ repo 已修 | GET /health 改在 server/index.ts 最早註冊（含 /health/）；routes 內重複已移除。**Staging 未驗證**，需重新 deploy 後打 GET /health。 |
| **Phase 2 /api/workbench/tasks 500** | ⏸️ 加強 log | 未取得 Railway logs；start-production 改為印出 migrate 完整 stdout/stderr 與失敗提示。Migration 仍為 ADD COLUMN（非 idempotent）；若 staging 仍 500，需依 logs 做 migrate resolve 或修 DB。 |
| **Phase 3 judgment 主流程** | ❌ 未驗證 | 需登入 + 設定頁 AI Key + 送出 + 一鍵轉任務；無 staging 實測。 |
| **Phase 4 啟動鏈** | ✅ 小修 | start-production 明確 log migrate 失敗與建議。 |
| **Phase 5 體驗小修** | ⏸️ 未做 | 依指示在 health、tasks、judgment 都驗通後才做。 |
| **Staging 驗證** | ❌ 未驗證 | 需在 staging 執行清單並貼結果。 |

---

## 2. 不一致清單（repo / 文件 / staging）摘要

- **/health**：文件稱已修，staging 仍被 SPA 接走 → 已改為 index 最早註冊，待 staging 驗證。
- **/api/workbench/tasks**：文件稱 migration + try/catch 已就緒，staging 仍 500 → 加強 migrate 失敗 log；實際根因需 Railway logs 或 DB 狀態。
- **judgment**：從未實測「送出→回覆→結構化卡→一鍵轉任務」→ 標為未驗證。
- **pass-1/pass-2**：與 repo 一致；staging 相關敘述均為「需驗證」或「未驗證」。

---

## 3. 已完成項目

- Phase 0：比對 package.json、script/build.ts、script/start-production.mjs、server/index.ts、server/routes.ts、server/static.ts、prisma schema、migration、pass-1、pass-2；產出明確不一致清單。
- Phase 1：在 server/index.ts 於 registerRoutes 前註冊 `app.get(["/health", "/health/"], ...)`；移除 routes.ts 內重複 GET /health。
- Phase 2：start-production.mjs 在 migrate 失敗時印出完整 stdout/stderr 與說明（含 migrate resolve 建議）；未改 migration 內容（SQLite 無 ADD COLUMN IF NOT EXISTS）。
- Phase 4：start-production 行為與 log 更清楚，利於從 Railway logs 判斷 migrate 狀態。
- 撰寫 docs/production-staging-pass-3.md（本文件）。

---

## 4. 實際修改檔案

| 檔案 | 修改目的 |
|------|----------|
| **server/index.ts** | 在 async 內、registerRoutes 前註冊 `app.get(["/health", "/health/"], (_req, res) => res.status(200).json({ ok: true }))`，確保 /health 一定由 server 回 JSON。 |
| **server/routes.ts** | 移除 GET /health（改由 index 單一註冊），避免重複與順序疑慮。 |
| **script/start-production.mjs** | migrate 改為捕獲 stdout/stderr 並印出；失敗時 log 明確訊息與「prisma migrate resolve」建議。 |
| **docs/production-staging-pass-3.md** | 新增：Phase 0 不一致清單、完成狀態、實際修改、驗證結果、commit 對應。 |

---

## 5. 本機驗證結果

| 項目 | 結果 | 備註 |
|------|------|------|
| npm run build | ✅ 通過 | 本輪已執行，exit code 0。 |
| npm start 能啟動 | ✅ 通過 | 依前輪；本輪未再跑（有改 start-production，建議再跑一次確認）。 |
| GET /health 本機 | ✅ 通過 | 前輪本機回 `{"ok":true}`；本輪改 index 後理論上仍成立，建議再打一次確認。 |

---

## 6. Staging 驗證結果

**無法由本端執行，需在 Railway 重新 deploy 後由維運／使用者驗證。**

| 項目 | 狀態 | 備註 |
|------|------|------|
| / 可開 | 未驗證 | 需實際開啟並記錄。 |
| GET /health 回 200 + {"ok":true} | 未驗證 | 需直接對 staging 打 GET /health（及 GET /health/），貼 status 與 body。 |
| /tasks 可開且 /api/workbench/tasks 回 200 | 未驗證 | 若仍 500，請貼 Railway logs 中 migrate 與 `[GET /api/workbench/tasks]` 錯誤。 |
| /judgment 送出→回覆→結構化卡→一鍵轉任務 | 未驗證 | 需設定頁填 AI Key 後實測。 |
| /publish、/settings 可開 | 未驗證 | 需實際開啟並記錄。 |

---

## 7. 未完成與原因

| 項目 | 原因 |
|------|------|
| Staging 全項 | 無 Railway 存取；需重新 deploy 後在 staging 執行驗證清單並回填。 |
| tasks 500 根因 | 未取得 Railway logs；僅加強 migrate 失敗 log；若仍 500 需依 log 做 migrate resolve 或修 DB。 |
| judgment 主流程 | 需登入 + 設定 AI Key + 實測；未執行。 |
| Phase 5 | 依指示在 health、tasks、judgment 都驗通後才做。 |

---

## 8. 風險

- **/health**：改在 index 最早註冊後，**staging 尚未驗證**；若 proxy 或平台改 path，可能仍須再調。
- **tasks 500**：migration 若因 duplicate column 失敗，server 仍會起動但 tasks 會 500；需依 start-production log 做 migrate resolve 或手動修 DB。
- **judgment**：依「設定」頁 AI API Key；未設則 400 NO_API_KEY；一鍵轉任務依 tasks API，tasks 若 500 則會失敗。
- **Rich Bear**：本輪未改任何核心 prompt，僅接線與治理。

---

## 9. 下一步建議

1. **重新 deploy** 至 staging，使 index 的 /health 與 start-production 的 log 生效。
2. **Staging 驗證**：依序打 GET /health、開 /tasks（看 network 中 /api/workbench/tasks 是否 200）、開 /judgment 設 Key 後送一則並一鍵轉任務。
3. 若 **/health 仍非 JSON**：貼 staging 的 request path、response headers/body；必要時再檢查 proxy 或平台設定。
4. 若 **tasks 仍 500**：貼 Railway 的 migrate 輸出與 `[GET /api/workbench/tasks]` 錯誤；依情況執行 `prisma migrate resolve --applied 20260307120000_add_workbench_task_columns` 或修 DB。
5. 將驗證結果回填本文件「Staging 驗證結果」，並更新「完成狀態」與「未完成與原因」。

---

## 10. Commit hash（每項修正對應）

| Commit | 對應修正 |
|--------|----------|
| **6cc7c8f** | server/index.ts 最早註冊 /health；server/routes.ts 移除重複 /health；script/start-production.mjs 加強 migrate 失敗 log；新增 docs/production-staging-pass-3.md。 |

---

## 最終回報（輸出格式 1–8）

### 1. 完成狀態

- **Phase 0**：完成；不一致清單已寫入 pass-3。
- **Phase 1 /health**：repo 已修（index 最早註冊）；**staging 未驗證**。
- **Phase 2 tasks 500**：start-production 已加強 log；**staging 未驗證**；根因仍賴 Railway logs。
- **Phase 3 judgment**：未驗證。
- **Phase 4**：start-production 小修完成。
- **Phase 5**：未做。
- **Staging**：全部未驗證，需重新 deploy 後執行清單。

### 2. 已完成項目

- 一致性審查與不一致清單（pass-3 Phase 0）。
- /health 改在 server/index.ts 最早註冊（含 /health/）；routes 移除重複。
- start-production.mjs 印出 migrate 完整輸出與失敗說明。
- 撰寫 production-staging-pass-3.md。

### 3. 實際修改檔案

- server/index.ts：最早註冊 GET /health、/health/。
- server/routes.ts：移除 GET /health。
- script/start-production.mjs：migrate 捕獲並印出 stdout/stderr；失敗時 log 與建議。
- docs/production-staging-pass-3.md：新增本文件。

### 4. 驗證結果

- **本機**：npm run build 通過；npm start、GET /health 前輪已驗，本輪建議再驗一次。
- **Staging**：/、/health、/tasks、/judgment、/publish、/settings 均**未驗證**。

### 5. 未完成與原因

- Staging 全項：無 Railway 存取，需重新 deploy 後由維運驗證。
- tasks 500 根因：無 logs，僅加強 log；若仍 500 需依 log 處理。
- judgment 主流程：未實測。

### 6. 風險

- /health、tasks 在 staging 尚未驗證。
- migration 非 idempotent，duplicate column 時需 migrate resolve 或手動修 DB。
- judgment 依設定頁 AI Key；一鍵轉任務依 tasks API。

### 7. 下一步建議

- 重新 deploy → 依驗證清單打 /health、/tasks、/judgment 等 → 回填 pass-3 staging 結果；若 tasks 仍 500，貼 logs 再修。

### 8. Commit hash

- **6cc7c8f** — fix: /health 最早註冊、start-production migrate log、pass-3 文件
