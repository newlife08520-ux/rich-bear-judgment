# 08 — TRUTH PACK, REVIEW PACK, AND VERIFY CHAIN

## Review ZIP 如何生成

- **腳本**：`script/create-review-zip.mjs`。  
- **Allowlist**：目錄 `client`、`server`、`shared`、`script`、`docs`、`.agents`、`prisma`；外加根目錄 `package.json`、lockfiles、`AGENTS.md` 等（**不含** `node_modules`、`dist`、`.env`、`.data`、`uploads` 等）。  
- **完成報告**：`listCompletionReportPaths` 與 manifest 列舉之路徑；**磁碟不存在者略過**，以實際打入 ZIP 者為準。  
- **時間戳**：`zipName = phaseLabel + YYYYMMDD-HHMM`；`inner:prep` 前會跑 `verify:release-candidate` 與 `capture-verify-full-outputs`。

## Manifest／Contents／canonical log

| 檔案 | 意義 |
|------|------|
| `docs/REVIEW-PACK-MANIFEST.json` | `zipName`、`phaseLabel`、`entryCount`、`completionReports`、`generatorVersion` 語意由封包流程維護 |
| `docs/REVIEW-PACK-CONTENTS.json` | 與 MANIFEST 的 `phaseLabel` 須一致（batch97_2） |
| `docs/VERIFY-FULL-OUTPUTS/create-review-zip-verified.txt` | 首行 `exit=0`；尾段 `--- packaged review zip (canonical) ---` 下一行為**當輪** `zipName`（batch78／78_1） |

**本 repo 對齊點（撰寫時）**：`phaseLabel` = `phase-batch15_9-complete`；`REVIEW_PACK_GENERATOR_VERSION` = `batch15_9`（`script/lib/review-pack-generator-version.mjs`）。**重跑封包會更新 zip 時間戳**，審查以**最後一次成功**之 manifest／verified log 為準。

## Trust tier（真實）

見 `docs/active/TRUTH-PACK-TIER-MODEL-v2.md`：

- **Tier A**：示意／合成。  
- **Tier B**：seeded-runtime（多數 `RUNTIME-QUERY-CAPTURES`、`LIVE-RUNTIME-CAPTURES`、截圖流程）。  
- **Tier C／D**：staging-sanitized／prod-sanitized — **多為契約或 placeholder**，不可當 production 真值。

## 目錄角色摘要

| 路徑 | 角色 |
|------|------|
| `docs/PAGE-STATE-SCREENSHOTS/` | UI 狀態與腳本截圖；對照 batch98 系列與首頁 v12 |
| `docs/RUNTIME-QUERY-CAPTURES/` | API 形狀 sample（Tier B） |
| `docs/LIVE-RUNTIME-CAPTURES/` | 名稱歷史相容；讀 `TIER-README.md` |
| `docs/SANITIZED-DB-SNAPSHOTS/` | 去識別 DB 範例（dormant、zero-spend 分類等） |
| `docs/UI-TRUTH-MAPPING.md` | UI ↔ 資料欄位對照 |
| `docs/SCREENSHOT-TO-DATA-MAP.md` | 截圖 ↔ 資料來源 |
| `docs/API-SAMPLE-PAYLOADS.md` | API 範例（batch101_1 tier 誠實標註） |

## Verify 主鏈（package.json 真實結構）

1. **`verify:product-restructure`**：`verify:ui-core` + `verify:intelligence` + `verify:review-pack-contracts`  
2. **`verify:release-candidate`**：`verify:core-regression` + 上列 + `verify:ops` + `verify:reviewer-trust`  
3. **`create-review-zip:verified`**：`wrap-create-review-zip-verified.mjs` → inner prep（含 2 + capture）→ 封 ZIP → batch73_1 freshness → postZip（batch78、78_1、review-zip-hygiene）

**為何比普通 code repo「更完整」**：強制驗收鏈涵蓋 scope、no-mock、AI contract、rule-alignment、首頁／Judgment／dormant／truth tier、manifest 對齊、ZIP hygiene，並產出可存證的 verify full outputs。

**為何仍非最終 production truth**：擷取與截圖主力為 **Tier B**；真實客戶環境的長尾、權限、延遲與髒資料 **無法**由一包 ZIP 完全代表。

## 最大 reviewer trust 風險

1. **把 Tier B 當 prod**：過度信任 sample JSON／截圖的數值。  
2. **manifest 與本機 zip 不同步**：未重跑 `create-review-zip:verified` 就拿舊 zip 對照新 manifest。  
3. **completionReports 列舉與磁碟**：不存在檔不會進 ZIP，敘事若仍稱「必含某報告」會漂移。  
4. **generatorVersion／phase 曾漂移**：已修 batch15_9；流程上仍需每次發版檢查。

## 下一步

- 維持「單一命令封包」習慣，並以 manifest 為交付指紋。  
- 推進 Tier C／D 真實擷取（若合規允許）或明確標註「僅契約」。  
- `docs/gemini-review-pack/` 十份為**濃縮敘事**；爭議以程式與 verify 腳本為準。
