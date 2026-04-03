# campaignParseCache 治理說明

## 目的

`parseCampaignNameToTags`（campaign/廣告名稱解析）的 in-memory cache，避免同一批 campaign 名稱在聚合與 fallback 路徑中重複執行 regex 與 fallback 解析。

## 實作位置

- **定義與邏輯**：`shared/tag-aggregation-engine.ts`
- **清除呼叫**：`server/routes.ts`，refresh 流程**一開始**（約 L1432）呼叫 `clearCampaignParseCache()`

## Cache key 正規化

- 函式：`normalizeCacheKey(name)`
- 規則：`name.trim()`、連續空白壓成單一空格、`\u00A0`（不換行空格）換成一般空格
- 同一 campaign 名稱在不同寫法下會對齊到同一 key，減少重複解析

## 上限與淘汰策略

- **上限**：`CACHE_MAX_SIZE = 10000`（筆）
- **淘汰**：`evictCacheIfNeeded()` 在每次 `set` 前檢查；若 `size > CACHE_MAX_SIZE`，刪除目前 keys 的前半（`slice(0, Math.floor(CACHE_MAX_SIZE / 2))`），再寫入新 key
- 因此 cache 不會無限制成長，長期記憶體有上界

## 清空時機

- **refresh 開始時**：`clearCampaignParseCache()` 在 refresh 非同步流程的一開始被呼叫，該次 refresh 會重新解析所有 campaign 名稱，舊 cache 不再沿用
- **手動**：測試或需控管時可自行呼叫匯出的 `clearCampaignParseCache()`

## 觀測

- `getCampaignParseCacheSize()`：回傳目前 cache 筆數，供監控或除錯

## 小結

| 項目 | 說明 |
|------|------|
| key 正規化 | `normalizeCacheKey`：trim、空白壓縮、\u00A0→空格 |
| 上限 | 10000 筆 |
| 淘汰 | 超過時刪前半 keys |
| 清空時機 | refresh 開始時 + 可手動 |
| 長期記憶體風險 | 有上限與淘汰、refresh 清空，有保護 |
