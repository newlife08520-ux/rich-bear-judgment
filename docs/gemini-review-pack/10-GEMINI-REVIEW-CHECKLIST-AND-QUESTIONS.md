# 10 — GEMINI REVIEW CHECKLIST AND QUESTIONS

> 寫給 **外部 reviewer（Gemini）**：先讀 `01`–`09` 與 `docs/active/GEMINI-REVIEW-STAGE0-AUDIT.md`，再用本清單質疑。

## 若你是外部 reviewer：先看的 10 個重點

1. **`REVIEW-PACK-MANIFEST.json`** 的 `phaseLabel`、`zipName`、`entryCount` 與 `create-review-zip-verified.txt` 尾段是否一致。  
2. **`script/lib/review-pack-generator-version.mjs`** 是否與 phase 敘事一致（現：`batch15_9`）。  
3. **`docs/active/TRUTH-PACK-TIER-MODEL-v2.md`**：哪些材料是 Tier B vs C／D。  
4. **`shared/visibility-policy.ts`**：0 spend 與桶別是否與首頁／商品／FB／CI 敘事相容。  
5. **首頁**：`homepageDataTruth` 與 `dataStatus` 是否被清楚區分（partial vs no data）。  
6. **`server/modules/execution/`**：哪些 handler 已接 UI、哪些仍僅 foundation。  
7. **`/publish` 路由**：是否仍為 placeholder；與 README 聲稱的差距。  
8. **`verify:release-candidate` 所涵蓋的腳本**（見 `package.json`）：哪些是契約測試、哪些需要真實 Graph API。  
9. **巨型檔**：`server/routes.ts`、`shared/schema.ts` 是否與「可維護」聲稱矛盾。  
10. **`docs/OPEN-ISSUES-AND-BLOCKERS.md`**：團隊自認缺口是否與你讀 code 的感覺一致。

## 你應該質疑的系統部位

- **決策可信度**：規則引擎 + precompute + AI 三者邊界；錯誤時誰負責、使用者看到什麼。  
- **資料新鮮度**：batch 失敗、部分欄位缺失時 UI 是否誠實。  
- **Execution**：dry-run 是否可被繞過；apply 是否總有稽核。  
- **審查包完整性**：ZIP 是否可能被誤當「線上環境快照」。  
- **Pareto／Goal pacing**：在樣本稀疏或觀察窗邊界是否產生誤導性「確定感」。

## 你應檢查的資料一致性

- 同一 scope 下，`/api/dashboard/action-center` 與 cross-account summary 的數字敘事是否可能打架。  
- Dormant 名單在 Dashboard vs Products vs FB vs CI 是否同源、同排序哲學。  
- Settings 閾值變更後，precompute 與即時路徑是否同一版本規則。  
- API sample JSON（`API-SAMPLE-PAYLOADS.md`）與實際 handler 回傳欄位是否漂移。

## 如何區分成熟度標籤

| 標籤 | 判準 |
|------|------|
| **已成熟** | 有端到端 UI + 主線 verify + 真實路徑可描述 |
| **First version** | 結構對但邊界／UX／極端資料未收斂 |
| **File/docs-only** | 僅 md／sample／契約測試，無對應產品路徑 |
| **Seeded-truth（Tier B）** | 本機／固定種子擷取；非客戶 prod |
| **True-runtime-truth** | 須明確標註來源；本 repo 主力仍 **非**全面 Tier D |

---

## 至少 25 個具體問題（請逐題要證據）

1. `phase-batch15_9-complete` 與 `batch15_9` generator 是否在**最近一次**封包後仍一致？證據是什麼檔案？  
2. `create-review-zip-verified.txt` 第一行是否為 `exit=0`？若不是，該 ZIP 是否仍應被信任？  
3. 首頁 **partial_decision** 時，五區卡片是否仍應顯示？誰決定？  
4. **no_decision** 與「無 batch」在 UI 上是否可能被使用者混為一談？  
5. `visibility-policy` 中 0 spend 的列是否保證在任何列表頁都**不會**被全量 filter 掉？  
6. Dormant 的 `revivalPriorityScore` 與 ROAS 排序是否獨立？請指出計算模組。  
7. Goal pacing 的 **observation window** 與 Meta 報表延遲疊加時，系統如何避免「過早判死刑」？  
8. **todayAdjustCount** 在哪些 API 讀寫？若使用者只改 Meta 後台不經本系統，計數是否失真？  
9. **targetOutcomeValue** 與廣告帳戶實際優化目標不一致時，pacing 文案是否仍會顯示？  
10. Pareto 多層在 entity 數 < N 時如何退化？會不會顯示誤導性「頂層」？  
11. batch29_1 所謂 ambiguous 案例在 UI 上長什麼樣？  
12. Judgment **Focus** 與 **Operator** 的資料來源是否完全相同？若不同，為何？  
13. 從首頁 command 深連結到 FB／Products／CI 時，query 參數是否總能還原同一實體？  
14. `ExecutionGateDialog` 是否覆蓋**所有**會寫入 Meta 的按鈕？請列出例外（若有）。  
15. pause／resume／budget 失敗時，使用者看到的錯誤是否可行动？  
16. Publish draft execute handler 是否已被任何**非測試** UI 路徑呼叫？  
17. Task create from judgment 的 dry-run 記錄保留多久？是否可被審計追溯？  
18. Precompute 與 live API 數值衝突時，哪個為「首頁真理」？  
19. `test:roi-funnel` 通過是否代表儀表板 ROI 卡同一邏輯？  
20. Prisma／DB 模型中與 execution 稽核相關的表，是否在 ZIP 內的 schema 可讀？  
21. `SANITIZED-DB-SNAPSHOTS` 的版本是否與當前 migration 對齊？如何驗？  
22. 截圖 `PAGE-STATE-SCREENSHOTS` 對應的 build 版本如何標註？過期截圖風險誰扛？  
23. `UI-TRUTH-MAPPING.md` 是否涵蓋首頁 v12 所有主欄位？缺了什麼？  
24. Tier C／D 目錄若為空或 placeholder，文件是否仍聲稱「有 prod 真值」？  
25. `server/routes.ts` 單檔超過 2000 行，新增路由時如何避免與現有 middleware 衝突？團隊策略是什麼？  
26. `shared/schema.ts` 與 client 表單驗證是否單一來源？若否，漂移點在哪？  
27. AI contract 測試是否禁止 live decision 路徑使用 mock？違例時會在哪個 verify 失敗？  
28. `verify:no-mock-in-live-decision` 的「live」定義邊界為何？是否涵蓋 SSR 或僅 client fetch？  
29. 多使用者／多 session 同時 refresh 時，Phase2 驗收所保證的不污染是否仍成立？  
30. 若 `completionReports` 列了不存在的路徑，ZIP 內實際少了檔，是否應視為交付瑕疵？  
31. 本系統與「普通 GA 報表」的三句差異，能否用**使用者可感知**的行為說明，而非口號？  
32. 你最不滿意的一個 UX（從截圖與 05 號文件）是什麼？建議怎麼改才不改憲法／persona？

---

**下一步**：將以上問題的答案對回 **程式路徑、verify 腳本名稱、或 Tier 標籤**；無法對回者列為 **高風險未知**。
