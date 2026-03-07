# Phase B 完成回報

## 1. 改了哪些檔案

| 檔案 | 變更 |
|------|------|
| `server/modules/asset/asset-package.schema.ts` | 建立時僅 **名稱** 必填；`brandProductName`、`primaryCopy`、`headline`、`cta`、`landingPageUrl` 改為 `.default("")`；`adObjective` 預設 `"sales"`，`status` 預設 `"draft"`。 |
| `server/modules/asset/asset-package-service.ts` | 建立時若 `brandProductName` 為空則自動帶入 `name`。 |
| `client/src/pages/assets.tsx` | ① 建立畫面改為僅「名稱」「產品名稱」（產品名稱 placeholder：預設帶入名稱，可後補）；② 建立成功後自動選中該包、`setJustCreatedPackageId` 並 scroll 至版本區；③ 右側選中素材包時**先顯示「素材版本」卡、再顯示「素材包主檔」卡**；④ 素材包主檔表單改為「名稱 / 產品名稱」+ 摺疊「預設文案，可後補」（主文案、標題、CTA、落地頁、備註）；⑤ 廣告目的、狀態自表單與列表移除，後端仍送預設值；⑥ 左側列表移除廣告目的、狀態 Badge，產品名稱空時顯示「—」。 |

---

## 2. 沒改哪些檔案

- `App.tsx`、`app-sidebar.tsx`
- `dashboard.tsx`、`fb-ads.tsx`、`ga4-analysis.tsx`、`judgment.tsx`、`history.tsx`、`settings.tsx`、`login.tsx`、`not-found.tsx`
- `publish-placeholder.tsx`、`publish-history-placeholder.tsx`、`server/modules/publish/*`
- `upload-provider*`、`upload-storage.ts`、`asset-package-routes.ts`、`asset-version-*`、`asset-package-repository.ts`
- `shared/schema.ts`（未改型別）
- `routes.ts`（僅沿用 Phase A）

---

## 3. 哪些既有行為保證不變

- 左側導覽、戰情、FB、GA、判讀、紀錄、設定：無改動。
- 投放中心與投放紀錄：無改動。
- 素材中心 API 路徑與回應格式不變；既有素材包與版本仍可編輯、顯示、刪除；列表與詳情仍顯示產品名稱（空則「—」）。
- 登入與權限、userId 隔離不變。

---

## 4. 操作前後差異

| 項目 | 舊流程 | 新流程 |
|------|--------|--------|
| **最短路徑步數** | 建立必填：名稱、品牌/產品、廣告目的、狀態、主文案/標題/CTA/網址（或至少多項）；建立後需手動點選該包再點「新增版本」。 | **僅名稱必填** → 建立 → **自動選中該包並捲至版本區** → 點「新增版本」上傳。 |
| **阻擋建立的欄位** | 品牌/產品、廣告目的、狀態、主文案、標題、CTA、落地頁皆可擋或造成必填感。 | **無**：僅名稱必填；產品名稱可後補且後端可自動帶入名稱。 |
| **建立後如何進上傳** | 建立後停留在建立表單或需自己從左側再點一次該素材包，再在下方找「新增版本」。 | 建立成功後**自動選中該素材包**、右側**先顯示「素材版本」卡**並 **scroll 至版本區**，可立刻點「新增版本」上傳。 |
| **最快完成一個素材包** | 填多欄 → 建立 → 手動選包 → 找版本區 → 新增版本。 | **填名稱 → 建立 → 立刻在版本區點「新增版本」→ 上傳並儲存版本**。 |

---

## 5. 風險

- **既有資料**：已存在素材包之 `adObjective`、`status` 仍存在 DB，僅 UI 不顯示；列表不再顯示該兩項 Badge，不影響讀寫。
- **產品名稱空**：建立時未填產品名稱會由後端帶入名稱；列表空時顯示「—」。
- **Collapsible 文案區**：預設摺疊，若使用者未展開則不會看到主文案等欄位，需依賴「預設文案，可後補」觸發展開。

---

## 6. Rollback

- **後端**：還原 `asset-package.schema.ts` 的必填與預設（`brandProductName` min(1)、`adObjective`/`status` 無 default 等）；還原 `asset-package-service.ts` 的 `brandProductName` 自動帶入邏輯。
- **前端**：還原 `assets.tsx` 的右側順序（先主檔再版本）、表單結構（完整表單含廣告目的/狀態）、建立流程與 scroll、左側 Badge。
- **資料**：未改 repository 格式；已建立「僅名稱、產品名為空」的素材包仍存在，rollback 後若 schema 再次必填，更新時需補填。

---

## 7. Acceptance steps

1. **僅名稱必填**：點「新增素材包」→ 只填名稱、產品名稱留空 → 建立 → 成功；列表顯示該包，產品名稱顯示為名稱（後端帶入）或「—」。
2. **建立後直接進上傳**：建立成功後右側自動為該素材包，且「素材版本」卡在最上方並捲至可見；可立刻點「新增版本」上傳一檔並儲存版本。
3. **文案區預設摺疊**：選一素材包後，右側「素材包主檔」區只有名稱、產品名稱與「預設文案，可後補」摺疊；展開後才見主文案、標題、CTA、落地頁、備註。
4. **廣告目的/狀態不顯示**：建立與編輯表單、左側列表皆無廣告目的與狀態欄位/Badge；後端仍收到預設「銷售」「草稿」。
5. **既有行為**：既有素材包可正常點選、編輯、儲存、刪除；版本列表與新增/編輯版本行為不變。
