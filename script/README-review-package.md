# 審查包：產出與驗收

## Canonical（建議）：Node ZIP + 完整 verify 鏈

在**專案根目錄**：

```bash
npm ci
npx prisma generate
npm run verify:release-candidate
npm run create-review-zip:verified
```

- **Canonical 驗收（建議）**：`npm run create-review-zip:verified`（內含 `verify:release-candidate`，並於 ZIP 前再跑 `verify:batch14:script-chain-integrity` 確保 npm script 鏈無斷裂）。
- **最終閘門**：`npm run verify:final`（等同 `verify:release-candidate`）。
- **`verify:release-candidate`**：含 core 回歸、product-restructure、**operations-ready**（execution / rollback UX / routes split B / meta publish foundation / publish DB / meta operator / review-pack manifest）、Auth、products/history、baseline。
- **`create-review-zip:verified`**：在上述全綠後執行 **`node script/create-review-zip.mjs`**，並再跑審查包可攜性、manifest 一致性與衛星腳本。

產物：

- **`phase-batch<版本>-YYYYMMDD-HHMM.zip`**（專案根目錄）
- **`<zipName>.sha256`**：ZIP 檔本身的 SHA-256（sidecar，供校驗下載完整性）
- **`docs/REVIEW-PACK-MANIFEST.json`**：記錄 `zipName`、`phaseLabel`、`createdAt`、`entryCount`、`completionReports`、**`payloadSha256`**（ZIP 內容 hash，排除 manifest 自身；ZIP 檔 digest 見 .sha256 sidecar）

**指定要檢查的 ZIP**（不依賴「最新 mtime」）：

```bash
npx tsx script/verify-review-zip-hygiene.ts --zip your-phase-zip.zip
set REVIEW_ZIP_PATH=your-phase-zip.zip
npm run verify:batch5_1:review-pack-portability
```

解析順序：**`--zip`** → 環境變數 **`REVIEW_ZIP_PATH`** → **`docs/REVIEW-PACK-MANIFEST.json`** → 根目錄最新 `phase-*.zip`。

---

## Legacy／手動：PowerShell 目錄複製包

```powershell
.\script\create-review-package.ps1
```

會在上層目錄建立 **Du-She-Shen-Pan-Guan-review**（排除 node_modules、.git、.env、uploads 等）。**不作為**官方審查 ZIP 替代品；正式交付以 **fflate ZIP + manifest** 為準。

複製包內若需驗證，仍建議：

```bash
npm ci
npx prisma generate
npm run verify:release-candidate
```

---

## 注意

- 部分 verify 依賴 **Prisma／本機 DB**；無 DB 時部分腳本可能失敗，屬環境限制。
- 舊文件曾寫「只跑到 `verify:baseline` + 舊意義的 `verify:final`」；**現行 `verify:final` 即等於 `verify:release-candidate`**，且 release-candidate 已納入 **verify:operations-ready**（execution / publish / meta / review-pack manifest），請以上方 canonical 流程為準。
