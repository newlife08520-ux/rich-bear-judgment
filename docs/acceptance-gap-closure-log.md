# 驗收缺口收斂執行紀錄

依 `cursor_acceptance_gap_closure.md` 逐步執行，每步：code + verify + docs + stdout。

---

## 兩份清單差異

- 已比對 `cursor_acceptance_gap_closure.md` 與 `cursor_acceptance_gap_closure (2).md`：**內容完全一致，無差異**。

---

## Step 0.3：Baseline 驗證腳本（完成）

### Code
- 新增 `script/verify-baseline.ts`：執行 `npm run check` → `npm run build`，任一步失敗 exit 1，stdout 寫入 `sample-data/verify-baseline-output.txt`。
- `package.json` 新增 `"verify:baseline": "tsx script/verify-baseline.ts"`。
- 建立 `sample-data/` 目錄。

### Verify
- 已執行 `npm run verify:baseline`（預期失敗，因 check 未過）。

### Stdout（Step 0.3 verify:baseline）
```
[verify:baseline] Running npm run check...
[verify:baseline] npm run check: FAILED (exit 1)
```
完整 tsc 錯誤清單已寫入 `sample-data/verify-baseline-output.txt`。

### 下一步
- Step 1.1 / 1.2：修到 `npm run check` 與 `npm run build` 通過，再重跑 verify:baseline。

---

## Step 1.1 / 1.2：TypeScript 與型別修復（完成）

### Code
- **server/routes.ts**：TodayActionRow/suggestedPct、getParam、rowsForCreative frequency、account-exceptions 型別、updateWorkbenchTask updatedAt。
- **shared/decision-cards-engine.ts**：ROAS_TARGET_MIN、deriveProduct 危險分支與 DerivedProduct。
- **server/gemini.ts**：parseGeminiResponse 回傳型別。
- **server/lib/upload-temp.ts**：originalname 取用方式。
- **client/pages/dashboard.tsx**：ProductRedBlackBoard productLevel（含 campaignCount）。
- **client/pages/settings-prompts.tsx**：publishedAt。
- **client/pages/tasks.tsx**：status 斷言為 TaskStatusKey。
- **client/pages/products.tsx**：Row 型別、filter/map/reduce 回調型別、PRODUCT_STATUS key、ownerIds.includes、map 參數型別。
- **script/verify-baseline.ts**：通過後寫入最終 stdout。

### Verify
- `npm run check`：通過。
- `npm run build`：通過。
- `npm run verify:baseline`：通過。

### Stdout（verify:baseline 本輪）
完整輸出已寫入 **sample-data/verify-baseline-output.txt**。摘要：
```
verify-baseline @ 2026-03-16T17:53:41.543Z
--- npm run check ---
[OK] npm run check
--- npm run build ---
[OK] npm run build
[verify:baseline] All passed (check + build).
```

### Docs
- **docs/cursor-rebuild-verification-report.md**：已更新 A（本輪修改檔案）、G（Baseline 通過）、H（尚未完成風險）、總結。
- **docs/acceptance-gap-closure-log.md**：本段 Step 1.1/1.2 紀錄。

### 下一步
- Step 2.1：四層憲法（product / decision / persona / prompt constitution 四個 md）。
- Step 2.2：主模組與導航重整。
- Step 3.1～7：scope、Dashboard、Live 路徑、AI 契約、rule alignment、routes 拆分、持久化與 auth 文件。

---

## Step 2.1：四層憲法（完成）

### Code
- 新增 **docs/constitution/** 目錄及四份憲法：
  - **product-constitution.md**：產品定位、使命、總原則、介面靈魂、頁面對應分層、與他憲法關係。
  - **decision-constitution.md**：硬判斷由引擎決定、SSOT、不准亂判規則、真好/假好/可救/真爛、Rule Alignment。
  - **persona-constitution.md**：唯一靈魂、Boss/投手/創意為視角、Workflow 為真入口、人格與操盤分工、Core/Calibration 來源。
  - **prompt-constitution.md**：Runtime 組裝順序、各層唯一來源、雙層架構、審判路徑、不可變原則。

### Verify
- 未改動程式碼；`npm run check` 仍通過（四層憲法僅為 docs）。

### Docs
- **docs/cursor-rebuild-verification-report.md**：B 節更新為四層憲法已建立與摘要。
- **docs/acceptance-gap-closure-log.md**：本段 Step 2.1 紀錄。

### Stdout
- 無（本步僅新增文件）。

### 下一步
- Step 2.2：主模組與導航重整（主導航 5 個、次導航、任務降級為行動紀錄）。
- Step 3.1～7：scope、Dashboard、Live、AI 契約、rule alignment、routes 拆分、持久化與 auth。

---

## Step 2.2：主模組與導航重整（完成）

### Code
- **client/src/components/app-sidebar.tsx**：主導航 5 個（決策區：今日決策、行動紀錄、商品、審判官；成長區：次導航；設定區：次導航）。任務中心改為「行動紀錄」、primary: false 視覺降級。分析併入成長；工具改為「設定」。

### Verify
- `npm run check` 通過。

### Docs
- 本段紀錄。

---

## Step 3.1：Scope 完整性（完成）

### Code
- **client/App.tsx**：AuthenticatedApp 接收 user，AppScopeProvider 傳入 userId={user.id}。
- **client/hooks/use-app-scope.tsx**：localStorage 改為 per-user（storageKey(userId) = app-scope:${userId}）；loadScope/persistScope 依 userId；scopeKey 納入 customStart/customEnd。
- **shared/schema.ts**：buildScopeKey 新增 optional customStart, customEnd，preset 為 custom 時 key 含 custom:start~end。
- **server/routes.ts**、**server/storage.ts**：refresh 與 batch 的 scopeKey 建構納入 custom 區間；getBatchForScope 簽名與實作支援 customStart/customEnd。
- **script/verify-scope-integrity.ts**：新增；驗收 buildScopeKey custom、per-user key 語意；納入 verify:final。package.json 新增 verify:scope-integrity。

### Verify
- verify:scope-integrity 通過；verify:baseline 通過。

---

## Step 3.2：Dashboard 單一上下文（完成）

### Code
- **script/verify-dashboard-scope-unification.ts**：新增；檢查 dashboard 使用 useAppScope 與 action-center API。package.json 新增 verify:dashboard-scope-unification；納入 verify:final。

### Verify
- verify:dashboard-scope-unification 通過。

---

## Step 3.3：Live 路徑移除 mock GA4（完成）

### Code
- **server/build-action-center-payload.ts**：移除 fetchMockGA4DataByProduct；ga4Rows 改為 []（live 路徑不再使用 mock）。
- **server/routes.ts**：兩處移除 fetchMockGA4DataByProduct，改為 ga4Rows = []；移除對應 import。
- **script/verify-no-mock-in-live-decision.ts**：新增；檢查 routes.ts 與 build-action-center-payload.ts 未使用 fetchMockGA4DataByProduct。package.json 新增 verify:no-mock-in-live-decision；納入 verify:final。

### Verify
- verify:no-mock-in-live-decision 通過；verify:baseline、verify:final 通過。

### 下一步
- Step 4.1：AI 契約統一（parseStructuredJudgmentFromResponse 與 gemini 同一套 extract + schema）、verify-ai-contract-unification.ts。
- Step 4.2：Rule alignment 接到所有對外輸出 path、verify-rule-alignment-production-paths.ts。
- Step 5～7：routes 拆分、持久化邊界、auth 文件。

---

## Step 4.1：AI 契約統一（完成）

### Code
- **server/lib/extract-json.ts**：已存在，統一 JSON 擷取（\`\`\`json 區塊 → 整段 parse → 首尾括號）。
- **server/gemini.ts**：使用 `extractJsonFromText` from lib/extract-json。
- **server/parse-structured-judgment.ts**：使用同一 extract + `StructuredJudgmentSchema`（gemini-response-schema）驗證。
- **script/verify-ai-contract-unification.ts**：新增；檢查 extract 與 schema 共用。package.json 新增 verify:ai-contract-unification；納入 verify:final。

### Verify
- verify:ai-contract-unification 通過。

---

## Step 4.2：Rule alignment 接到所有對外輸出 path（完成）

### Code
- **script/verify-rule-alignment-production-paths.ts**：新增；檢查所有輸出 structuredJudgment 的 handler 皆在回應前呼叫 validateJudgmentAgainstSystemAction。package.json 新增 verify:rule-alignment-production-paths；納入 verify:final。

### Verify
- verify:rule-alignment-production-paths 通過。

---

## Step 5：拆 routes（完成）

### Code
- **server/routes/auth-routes.ts**：新增；登入、登出、me 自 routes.ts 拆出，`registerAuthRoutes(app)`。
- **server/routes.ts**：移除 auth 三支 endpoint，改為呼叫 `registerAuthRoutes(app)`。

### Verify
- npm run check 通過。

---

## Step 6：持久化邊界文件、batch metadata（完成）

### Code
- **docs/persistence-boundary.md**：已存在；補註為「持久化邊界與 batch metadata 之唯一說明」。內容含 .data 目錄、Batch metadata（buildScopeKey、寫入/讀取/持久化）、信任邊界。

### Verify
- 無需額外腳本；文件已就緒。

---

## Step 7：auth-hardening-plan.md、標記 prototype auth（完成）

### Code
- **docs/auth-hardening-plan.md**：新增；說明目前為 Prototype Auth（明文密碼、memory session）、風險、強化項目（雜湊、持久化 session、CSRF、rate limit、稽核）、強化後驗收條件。
- **server/routes/auth-routes.ts**：檔案頭註解已標記「目前為 Prototype Auth：明文密碼比對、memory session，見 docs/auth-hardening-plan.md」。

### Verify
- 無需額外腳本；文件與標記已就緒。

---

## 缺口收斂本輪總結

- **Step 0.3～3.3**：Baseline、憲法、導航、Scope、Dashboard 單一上下文、Live 移除 mock GA4。
- **Step 4.1～4.2**：AI 契約統一、Rule alignment 全 path 驗收。
- **Step 5～7**：routes 拆分（auth）、持久化邊界文件、auth-hardening-plan 與 prototype 標記。

後續可選：更多 routes 拆分（dashboard、content-judgment、refresh 等）、巨型頁面拆元件、verify:final 全綠後宣稱「可接受完成」。
