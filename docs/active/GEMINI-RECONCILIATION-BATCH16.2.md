# Gemini 整合規格 — Ground Truth Reconciliation（Batch 16.2 對照）

對照來源：外部規格「審判官／Product Restructure／Commercial Readiness／Reviewer Trust」硬化清單。本檔為 **repo 真實狀態** 與規格落差之單一對照表（2026-03-31 工作樹基準）。

## 三欄總表

| Already Landed | Partial / First Version | Still Missing |
|----------------|-------------------------|---------------|
| **Publish**：dry-run → gate → `meta_publish_draft_execute`；Prisma 草稿；`mapMetaOrNetworkErrorToActionability`；無「即將開放」類死路文案（精靈內 `placeholder` 僅表單提示，非頁級假閉環） | **Publish 產品化**：Stage1 最小寫入；三層 Campaign UI 非終局；happy path 須以真帳號截圖／runtime capture 自證（本 repo 不偽造 prod） | **Publish**：全自動投放敘事、完整創編管線 UI、無 token 環境之 E2E 錄影 |
| **Out-of-band**：快照 `MetaCampaignBudgetSnapshot`、`computeOutOfBandHints`、`ExternalMetaDriftBanner`；`acknowledge-external-drift` + `resetAdjustCountsForUserToday` | **偵測**：即時 Graph 與快照比對預算／狀態；`updated_time` 維度見 `OUT-OF-BAND-SYNC-DESIGN.md`「v2 強化方向」**文件**已寫，程式未強制 | **OOB**：Graph `updated_time` 與 `metaUpdatedAt` 並列比對實作、專題 DB before/after 快照（須真環境擷取） |
| **Execution audit**：`/execution-history`；篩選；欄位含 userId／目標／rollback 摘要／錯誤；`execution-log-display` 共用 | **Cross-links**：儀表板（首頁）、商品、發佈、FB 皆有連至全域稽核（FB 含 `link-fbads-to-execution-audit`） | **Audit**：首頁若未登入無連結（預期）；更細 **proof pack** 截圖矩陣（待真環境） |
| **Meta UX**：`meta-error-actionability`；`MetaApiErrorProvider` + `MetaGlobalErrorBanner`；Publish／Dashboard／FB／Judgment 回報脈絡 | **Audit log**：execution 寫 DB／API 可被查；全域 banner TTL ~15m | **Meta**：每一支 Graph 呼叫點都顯式映射（部分仍依 toast／頁內錯誤） |
| **Partial / No data**：`shared/data-truth-state-machine.ts`；playbook；首頁 truth 欄位；granular `cross-surface-truth-consistency` | **UI 鎖定**：各面「partial 時可／不可」矩陣未全部集中於單一 verify | **Partial**：全站單一「操作鎖定」矩陣 verify（規格 `partial-ui-action-locking`） |
| **Tier D**：三份 dirty JSON + 文件 + pareto/pacing granular | **第三類「delayed attribution」** 專屬 pack 命名與矩陣仍與長尾／稀疏樣本合併敘述 | **Tier D**：獨立 delayed-attribution 快照與專用 verify（`dirty-pack-integrity` 等） |
| **Learning / dormant / CI**：engine `learningPhaseProtected`；`DORMANT_NOISE`／`lowConfidenceDormant`；CI 統計揭露與 demotion hint | 同上，已有多支 granular | **無**（規格 16.4 多為強化截圖對照，非缺程式） |
| **Routes／Schema strangler**：`fb-ads-api-routes`、`publish-routes`、`publish-draft-contract` re-export；`ROUTES/SCHEMA` progress A + v16 文件 | **Progress B**：dashboard／execution／meta 再拆之「實際第二刀」未在 16.2 單次交付完成 | **16.5**：`routes.ts`／`schema.ts` 再拆模組（須 strangler，禁止大爆炸） |
| **Strategic UI**：batch98–100 verify（首頁指令、hierarchy、judgment focus） | **War-room polish**：規格 16.6 之視覺層級再收斂 | **16.6**：大規模 UI 重排（僅允許 hierarchy／降噪，不變商業語意） |
| **Canonical 鏈**：`verify:ui-core` … `create-review-zip:verified` 如 `package.json`；`verify:commercial-readiness` = chain + granular `all` | **Truth vNext**：`batch101` 已驗 v2 tier；**v3 文件**於本輪補上 + `verify:batch101_3` | **Truth**：真 staging／prod-sanitized 擷取（無則維持 tier 標示與 contract，不偽造） |

## package.json 與敘事

- Canonical 名稱與 `docs/active/VERIFY-CHAIN-CANONICAL-MAP-v2.md` 一致；未新增平行「隱形」主鏈。
- 本輪新增 **`verify:batch101_3:truth-pack-tier-model-v3`**，掛在 **`verify:review-pack-contracts`**（因而進入 `product-restructure` / `release-candidate`）。
- 本輪新增 granular：**`commercial-readiness-gemini-doc-surface`**（Gemini 要求之 v2／v3／Next 審查材料存在性）；並強化 **`cross-surface-execution-links`**（商品／發佈／FB）。
- **Generator**：`batch16_2`（`verify-commercial-readiness-chain` + `REVIEW_PACK_GENERATOR_VERSION`）。

## ZIP／manifest／contents

- 以 **`npm run create-review-zip:verified`** 當下產物為準；規格要求 `create-review-zip-verified.txt` 首行 `exit=0` 且含最新 `zipName`。

## Gemini 批判點是否仍成立（摘要）

| 批判方向 | 現狀 |
|----------|------|
| 無 commercial 子鏈 | **已不成立**（`verify:commercial-readiness` + granular）。 |
| Meta 錯誤只塞在 dialog | **已弱化**：全域 banner + 多面回報。 |
| Publish 假閉環 | **已弱化**：真最小寫入路徑 + 限制文件；**「全產品化」仍部分成立**（見上表 Partial）。 |
| Truth pack 未標 tier | **已弱化**：batch101 + v2 表；**v3 文件與 101_3 verify 本輪補強**。 |
| routes/schema 巨檔 | **部分成立**：已拆一階；**Progress B 仍待 16.5**。 |
