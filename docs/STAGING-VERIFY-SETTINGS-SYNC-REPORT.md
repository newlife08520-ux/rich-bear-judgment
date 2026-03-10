# [已廢棄，已合併至 docs/設定-驗證-同步鏈路-正式驗收.md]

**定位**：設定／驗證／同步鏈路修復版，可進主線。

---

## 1. Staging 驗收結果

以下需在 **Staging 環境手動執行**（需真實 FB/GA4 綁定與可用的更新資料流程）。

| 項目 | 預期行為 | 驗收方式 |
|------|----------|----------|
| **驗證成功後重整仍保留** | 測試連線成功後，storage.patchVerificationStatus 會寫入 fbStatus/gaStatus/aiStatus、*VerifiedAt、*ValidatedValueHash；GET /api/settings 回傳上述欄位；設定頁由 buildInitialResultFromSettings(settings) 初始化 ConnectionBlock。重整後應仍顯示「驗證成功」與上次驗證時間。 | 設定頁 → 輸入 FB 或 GA4 → 測試連線成功 → 重整頁面 → 確認燈號與「驗證成功」仍存在。 |
| **改值後驗證失效** | saveSettings 會用 valueFingerprint 比較新舊值；若 fingerprint 不同則 clear*Verification，將對應 status 設為 idle、*VerifiedAt 與 *ValidatedValueHash 清空。儲存後 refetch settings，前端會拿到 status=idle，ConnectionBlock 顯示「尚未驗證」。 | 驗證成功後 → 修改該欄位（例如 Token 改一個字）→ 只點「儲存所有設定」→ 確認該連線燈號變回「尚未驗證」。 |
| **同步帳號後同步數與最後同步時間正確更新** | POST /api/accounts/sync 會更新 storage syncedAccounts 並寫入 lastSyncedAt；GET /api/accounts/synced 回傳 accounts；SyncStatusBlock 顯示「已同步 N 個廣告帳號／N 個 Property」與「最後同步 MM/DD HH:mm」。 | 設定頁 → 點「立即同步帳號」→ 成功後確認 FB/GA4 的已同步數與「最後同步」時間有更新。 |
| **今日決策中心在同步 + 更新資料後是否出現真實數據** | 有 batch 且 batch.summary 存在時，cross-account-summary 回傳 hasSummary: true、dataStatus: "has_data"；dashboard 顯示摘要與決策區塊。若仍無 batch（例如尚未點「更新資料」），則為 synced_no_data。 | 同步帳號成功 → 到首頁點「更新資料」→ 等待完成 → 確認今日決策中心出現摘要／先救／可加碼等（或至少非全 0 的資料）。 |
| **無資料時空狀態文案是否正確區分** | hasSynced = (metaCount \|\| ga4Count) > 0；no_sync：尚未同步帳號；synced_no_data：已同步但尚未擷取數據。EmptyStateCard 標題為「尚未同步帳號」或「尚未擷取數據」，內文為對應 message。 | (1) 未同步過：應為「尚未同步帳號」+ 引導至設定頁綁定與同步。(2) 已同步但未點更新資料：應為「尚未擷取數據」+ 請點「更新資料」。 |

**結論**：依程式邏輯，上述五項皆已實作；實際結果請在 Staging 依上表手動跑一輪並勾選通過與否。若任一項未通過，請註明情境與畫面狀態。

---

## 2. 哪一段鏈路仍最容易誤解

- **「儲存成功」≠ 儀表板會有數據**  
  使用者常以為在設定頁按下「儲存所有設定」、看到「儲存成功」後，首頁就會自動有數據。實際上：
  - 儲存只會寫入設定（含驗證狀態與欄位變更後的失效邏輯）。
  - 要有「帳號列表」必須再點「立即同步帳號」。
  - 要有「決策中心數據」必須在首頁點「更新資料」觸發擷取與分析。  
  因此最容易誤解的是：**存好就等於完成整條鏈路**，而忽略「同步帳號 → 更新資料」兩步。

---

## 3. 是否要補儲存並同步

- **建議補**：在設定頁儲存成功後，增加下列其一（或都做）：
  - **選項 A**：按鈕改為「儲存並同步帳號」（一次做儲存 + 呼叫 POST /api/accounts/sync），或另提供「儲存並同步」按鈕。
  - **選項 B**：儲存成功 toast 或下方區塊加一句明確引導，例如：「設定已儲存。請點「立即同步帳號」取得帳號列表，再至首頁點「更新資料」產生決策數據。」  
  可避免使用者誤以為存好就會自動有數據，下一輪若只做一項，優先建議 **選項 B（引導文案）**，實作範圍小、不影響現有儲存/同步 API。

---

## 4. 實際修改檔案（本輪 5dc3686 涉及）

以下為設定／驗證／同步鏈路修復版常見會動到的檔案，供對照 commit 5dc3686：

| 檔案 | 說明 |
|------|------|
| `shared/schema.ts` | UserSettings 驗證相關欄位：fbStatus、gaStatus、aiStatus、*VerifiedAt、*LastError、*ValidatedValueHash |
| `server/storage.ts` | saveSettings 欄位變更時清除驗證；patchVerificationStatus 寫入驗證結果；getSyncedAccounts / saveSyncedAccounts、lastSyncedAt |
| `server/routes.ts` | PUT /api/settings；POST /api/settings/test-connection 呼叫 patchVerificationStatus；POST /api/accounts/sync；GET /api/accounts/synced；GET /api/dashboard/cross-account-summary 之 dataStatus（no_sync / synced_no_data / has_data）與 message |
| `client/src/pages/settings.tsx` | 從 /api/settings 初始化驗證狀態；ConnectionBlock initialResult；儲存後 invalidateQueries settings；SyncStatusBlock 同步數與最後同步時間 |
| `client/src/pages/dashboard.tsx` | summaryData.dataStatus、EmptyStateCard 標題與內文依 no_sync / synced_no_data 區分 |

（若 5dc3686 實際變更檔案與上表有出入，以 git show 5dc3686 為準。）

---

## 5. Commit hash

**5dc3686**（設定 / 驗證 / 同步鏈路修復版，已接受、可進主線）
