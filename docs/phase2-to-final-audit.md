# Phase 2 ~ Final 盤點報告

## 一、實際檔案與路徑（以 codebase 為準）

| 項目 | 實際路徑 | 備註 |
|------|----------|------|
| 主路由 | `server/routes.ts` | POST/GET refresh、action-center、scorecard、workbench/tasks、multer 上傳 |
| 儲存 | `server/storage.ts` | batchStore、refreshJobsStore、createRefreshJob、getRefreshJob、updateRefreshJob、getRunningJobByScopeKey、loadRefreshJobs、persistRefreshJobs；**無** listRefreshJobsByUser |
| Refresh runner | `server/refresh-job-runner.ts` | runRefreshJob(jobId)；存在 |
| Refresh 管線 | `server/refresh-pipeline.ts` | buildRefreshCandidateBatch；已有 PHASE2_INJECT_FAILURE 注入失敗 |
| 共用型別 | `shared/schema.ts` | RefreshJob、RefreshJobErrorStage、RefreshJobStatus；已有 |
| 標籤彙總 | `shared/tag-aggregation-engine.ts` | parseCampaignNameToTags、aggregateByProductWithResolver 等 |
| Scale 評分 | `shared/scale-score-engine.ts` | 存在（非 server 下） |
| Gemini / LLM | `server/gemini.ts` | callGeminiJudgment、parseGeminiResponse；**依賴 regex 擷取 markdown JSON** |
| 華麗熊 Prompt | `server/rich-bear-prompt-assembly.ts` | getAssembledSystemPrompt、buildDataContextSection 等 |
| API 路徑 | | |
| └ POST refresh | `POST /api/refresh` | routes.ts L1418；已改為建立 job + void runRefreshJob |
| └ GET refresh status | `GET /api/refresh/:jobId/status` | routes.ts L1478；已做 userId 比對 404 |
| └ GET refresh status (legacy) | `GET /api/refresh/status` | routes.ts L1472；getRefreshStatus |
| └ action-center | `GET /api/dashboard/action-center` | routes.ts L2231；precomputed → X-ActionCenter-Path |
| └ scorecard | `GET /api/dashboard/scorecard` | routes.ts L1838；precomputed → X-Scorecard-Path |
| └ workbench tasks batch | `POST /api/workbench/tasks/batch` | routes.ts L2098；**迴圈 await createWorkbenchTask**，無 createMany |
| Multer | `server/routes.ts` L640、`server/modules/asset/asset-package-routes.ts` L12 | **皆 memoryStorage()** |
| 批次 / job / AI | | |
| └ batch 讀寫 | storage.getLatestBatch、saveBatch、.data/latest-batch.json | 已存在 |
| └ job 持久化 | .data/refresh-jobs.json、loadRefreshJobs 啟動時 running→failed | 已存在 |
| └ AI judgment | gemini.ts parseGeminiResponse → JudgmentReport；**parse 失敗回 null** | 需改為 fallback 不 crash |
| └ prompt / zod | prompt-builder、overlay-structured、parse-structured-judgment | 多處 schema |

---

## 二、Phase 2 ~ Final 會動到的檔案

| Phase | 會動到的檔案 / 模組 |
|-------|----------------------|
| **Phase 2** | `server/routes.ts`（已大部份完成）、`server/storage.ts`（補 listRefreshJobsByUser）、`server/refresh-pipeline.ts`（補 REFRESH_TEST_MODE=fixture）、`script/*.ts`（驗收腳本）、`package.json`（verify:phase2） |
| **Phase 3** | `server/refresh-pipeline.ts`、`server/meta-data-fetcher.ts`、`server/ga4-data-fetcher.ts`（有限併發、retry）、新增 `server/lib/concurrency.ts`、`server/lib/retry.ts`、`server/routes.ts`（multer 改 disk）、`server/modules/asset/asset-package-routes.ts`（multer）、`server/routes.ts` POST workbench/tasks/batch、`server/workbench-db.ts`（若有 createMany） |
| **Phase 4** | `server/gemini.ts`（廢除 regex、structured output、fallback）、與 AI 回應形狀相關的 schema、parse-structured-judgment、overlay-structured |
| **Phase 5** | `server/rich-bear-prompt-assembly.ts`、context 摘要建構處、AI 輸出欄位（decisionSummary、supportingSignals 等） |
| **Final** | 各處結構化 log、`script/verify-final-regression.ts`、`package.json`（verify:all、verify:final）、`docs/*-report.md` |

---

## 三、高風險點

1. **Refresh 管線**：Promise.all 爆量併發（meta/ga4 多帳號）、無 retry；改動時不可改壞 candidate→publish 順序與失敗不寫 latest。
2. **Multer memoryStorage**：大檔上傳 OOM；改 disk 時需 temp 生命週期、cleanup、MIME/檔名檢查。
3. **Workbench batch**：逐筆 createWorkbenchTask 造成 N+1/延遲；改 createMany 需確認 transaction、ID 回傳、關聯。
4. **Gemini parse**：regex 抽 JSON、parse 失敗回 null 會讓 API 回 null/crash；改 structured + fallback 時不可改壞既有合法回應路徑。
5. **Prompt / 規則引擎**：AI 若可輸出與系統 action 相反的預算建議會「腦裂」；護欄與 context 壓縮不可改壞 V15 精神與既有公式。

---

## 四、需要 Test Seam 才能自驗的項目

| 項目 | 說明 |
|------|------|
| Refresh 全流程 | 不依賴真實 Meta/GA4 token；需 REFRESH_TEST_MODE=fixture 或 mock，讀 fixture 仍走 pipeline→precompute→publish。 |
| Refresh 失敗階段 | 已有 PHASE2_INJECT_FAILURE；可對齊 FORCE_REFRESH_FAILURE_STAGE，支援 meta_fetch、ga4_fetch、aggregation、precompute、persist、publish。 |
| AI 輸出 | 不依賴真實 LLM；需 AI_TEST_MODE=mock 回傳固定合法/非法樣本，驗證 structured parse、fallback、不 crash。 |
| Debug / verify API | 若有 /api/debug/*、/api/verify/* 等，僅 NODE_ENV=development 或明確 env 開啟，否則 404。 |

---

## 五、必須保持相容的 Response Shape

| API | 相容要點 |
|-----|----------|
| GET /api/dashboard/action-center | 成功路徑為 precomputed；res 含 precomputedActionCenter 結構；X-ActionCenter-Path: precomputed。 |
| GET /api/dashboard/action-center?scopeAccountIds=...&scopeProducts=... | 同上，scoped 時 filterActionCenterPayloadByScope。 |
| GET /api/dashboard/scorecard | precomputedScorecard.product / .person；X-Scorecard-Path: precomputed。 |
| GET /api/refresh/:jobId/status | jobId、status、createdAt、startedAt、finishedAt、errorStage、errorMessage、resultBatchKey、progressStep、progressMessage、scopeKey；跨使用者 404 body 僅 { error: "job not found" }。 |
| POST /api/refresh | { jobId, status, scopeKey }；同 scope 去重時可帶 message。 |
| AI judgment 相關 | 前端預期的 JudgmentReport / summary / detail 形狀；parse 失敗時改為回 fallback 物件而非 null，避免前端 crash。 |

---

## 六、Phase 1 已完成、不可破壞的功能

- **Precomputed 讀路徑**：build-action-center-payload、build-scorecard-payload 寫入 batch.precomputedActionCenter / precomputedScorecard；GET action-center / scorecard 優先讀 precomputed，設 X-*-Path: precomputed，否則 fallback。
- **Scale Readiness / ROI Funnel / 加減碼邏輯**：shared/scale-score-engine、roi-funnel、decision-cards-engine、profit-rules-store、campaign-decisions-store 等；僅能補護欄、不推翻既有公式。
- **V15 華麗熊 Prompt 架構**：rich-bear-prompt-assembly、prompts/rich-bear-core、overlay；只能補護欄、結構化輸出與摘要餵法，不推翻精神。

---

## 七、小結

- **Phase 2**：Job 型別、持久化、runner、candidate vs latest、去重、status 授權多數已實作；缺 listRefreshJobsByUser、**REFRESH_TEST_MODE fixture**、以及可本地跑滿的 verify 腳本與 npm run verify:phase2。
- **Phase 3**：需新增 concurrency/retry、替換 Promise.all 爆量、multer 改 disk、workbench batch 改批次寫入。
- **Phase 4**：gemini 廢除 regex parse、接 structured output + runtime validation、定義 fallback、parse 失敗不 crash。
- **Phase 5**：prompt 護欄、context 壓縮、AI 輸出欄位與對齊驗證。
- **Final**：結構化 log、verify:all、final-hardening-report；所有 verify 腳本 fail-fast、貼實際輸出。

下一步：先實作測試 seam（REFRESH_TEST_MODE、FORCE_REFRESH_FAILURE_STAGE、AI_TEST_MODE、debug guard），再依序完成 Phase 2 驗收腳本與 npm、Phase 3～5 與 Final。
