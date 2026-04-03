# groupSource 與偵測狀態規則（程式與文件一致）

## groupSource

- **suggested**  
  - **觸發條件**：建立版本（POST）時，表單的 `groupId` 非空且為上傳後系統依檔名建議的群組（未經使用者手動改過）。  
  - 實作：前端在「新建版本」且 `versionForm.groupId` 有值時送 `groupSource: "suggested"`；後端寫入。
- **manual**  
  - **觸發條件**：任一「編輯版本」（PUT）時，本次送出的 `groupId` 與該版本既有的 `groupId` 不同（使用者改動主素材組）。  
  - **一旦改為 manual 是否永遠維持 manual**：是。更新時只會送 `groupSource: "manual"`（當 groupId 有變更時），從未在更新時把已為 manual 的版本改回 suggested；後端也不會自動改回。因此一旦寫入 manual 即永久為 manual。

## detectStatus / detectSource（manual_confirmed）

- **何時寫入 manual_confirmed / manual**  
  - 僅在「編輯版本」且**比例（aspectRatio）實際被修改**時，前端才送 `detectStatus: "manual_confirmed"`、`detectSource: "manual"`。  
  - 只開編輯畫面、未改比例：不送這兩個欄位，不污染原有偵測狀態。
- **後端防呆**  
  - 更新版本時，若送出的 `aspectRatio` 與該版本既有值相同，後端會自 patch 中移除 `detectStatus` 與 `detectSource`，不寫入。即使前端誤送，也不會覆蓋成錯誤狀態。

## 摘要

| 情境 | groupSource | detectStatus/detectSource |
|------|-------------|---------------------------|
| 新建版本且帶建議的 groupId | suggested | 由上傳偵測結果決定（success/fallback/failed） |
| 編輯版本且只改 groupId | 送 manual（因 groupId 變更） | 不送，維持原偵測狀態 |
| 編輯版本且只改 aspectRatio | 不送，維持原 groupSource | 送 manual_confirmed / manual |
| 編輯版本且改 groupId 與 aspectRatio | 送 manual | 送 manual_confirmed / manual |
| 已為 manual 的版本再編輯 | 若 groupId 再變更仍送 manual | 僅 ratio 變更時送 manual_confirmed |
