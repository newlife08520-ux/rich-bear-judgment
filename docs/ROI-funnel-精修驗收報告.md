# ROI-funnel 精修驗收報告

## 精修項目與驗收

### 1) baseline_scope：預設 product，單一 account 花費占比 > 70% 時改為 product+account

| 項目 | 說明 | 驗收 |
|------|------|------|
| 邏輯 | `computeBaselineFromRows` 依 product 彙總 spend；若某 product 下單一 account 花費占比 > 70%，該 product 之 baseline 改為該 account 之 product+account 彙總 | ✅ 通過 |
| 常數 | `DOMINANT_ACCOUNT_SPEND_RATIO = 0.7`（可調） | ✅ |
| API/UI | creative-lifecycle 每筆回傳 `baseline_scope`（product / product+account）；卡片可顯示 | ✅ |
| 驗收案例 | 同一 product 兩筆 row，act_1 spend 800、act_2 spend 150 → P1 由 act_1 佔 84% → scope=product+account，`getBaselineFor("P1","act_1")` 回傳 scope=product+account | ✅ 通過 |

---

### 2) Other 拆成 NEEDS_MORE_DATA vs STABLE

| 項目 | 說明 | 驗收 |
|------|------|------|
| NEEDS_MORE_DATA | 資料量不足（!dataGate 且 clicks 或 spend 未達門檻）→ 需補足再判 | ✅ 通過 |
| STABLE | 漏斗健康但 ROI 未達標（funnelPass && !roasOk）；或其餘中性狀態 | ✅ 通過 |
| 順序 | STABLE 先於 Retired 判斷，避免漏斗健康僅 ROI 差被誤判淘汰 | ✅ |
| 驗收案例 | NEEDS_MORE_DATA：clicks=10, spend=100 → label=NEEDS_MORE_DATA；STABLE：clicks=60, atc=12, purchases=4, roas=0.5 → funnelPass 且 !roasOk → label=STABLE | ✅ 通過 |

---

### 3) scorecard 按人拆成 buyerOwnerId 與 creativeOwnerId 兩張

| 項目 | 說明 | 驗收 |
|------|------|------|
| API | `GET /api/dashboard/scorecard?groupBy=person` 回傳 `itemsByBuyer`（依 productOwnerId）、`itemsByCreative`（依 creativeOwnerId，fallback mediaOwnerId） | ✅ |
| UI | 成績單「按人」分頁顯示兩區塊：「依買手 (buyerOwnerId)」「依素材負責人 (creativeOwnerId)」 | ✅ |
| 驗收 | 切換到按人後出現兩張表，各自顯示 launchedCount、successRate、luckyRate、funnelPassRate、avgQualityScore、淘汰原因 | ✅ |

---

### 4) lifecycle 預設排序改為 priority

| 項目 | 說明 | 驗收 |
|------|------|------|
| 公式 | priority = impactTwd × confidenceMultiplier × (qualityScore/100)，impactTwd = revenue \|\| spend | ✅ |
| API | `GET /api/dashboard/creative-lifecycle` 之 `items` 已依 priority 降序排序；每筆含 `priority`、`baseline_scope` | ✅ |
| UI | 素材清單標題註明「依 priority 排序」，卡片可顯示 priority、baseline_scope | ✅ |

---

### 5) Lucky 一鍵生成「補量到門檻」任務，完成後自動重新分類

| 項目 | 說明 | 驗收 |
|------|------|------|
| API | `POST /api/dashboard/lucky-tasks/batch`：依目前 batch 跑 ROI 漏斗，篩出 label=Lucky，為每筆建立一則任務，action 為「補量到門檻（達 minClicks/minPurchases/minSpend 後再評估）」 | ✅ |
| 任務說明 | 任務 reason 含「完成後於下次資料刷新時將自動重新分類」 | ✅ |
| UI | 生命週期看板有「Lucky 一鍵生成補量任務 (N)」按鈕（N 為當前 Lucky 數）；完成後 toast 提示下次資料刷新會重新分類 | ✅ |
| 重新分類 | 完成補量任務後，於**下次資料刷新**（下次跑 batch 更新 Meta/GA 資料並重算 ROI 漏斗）時，該 campaign 會依新資料重新得到 label（如 Winner/Underfunded 等） | ✅ 文件與 UI 已說明 |

---

## 驗收腳本執行結果

```bash
npx tsx script/roi-funnel-acceptance.ts
```

- 主分類：Lucky、Underfunded、Winner、FunnelWeak → ✅ 4 通過  
- 精修分類：NEEDS_MORE_DATA、STABLE → ✅ 2 通過  
- baseline_scope：product+account 當單一 account > 70% → ✅ 1 通過  

**總計：7 通過，0 失敗。**

---

## 相關檔案

| 精修項 | 檔案 |
|--------|------|
| baseline_scope | `shared/roi-funnel-engine.ts`（computeBaselineFromRows、getBaselineFor、evidence.baseline_scope） |
| NEEDS_MORE_DATA / STABLE | `shared/roi-funnel-engine.ts`（LifecycleLabel、computeRoiFunnel 分支與順序） |
| scorecard 兩張 | `server/routes.ts`（itemsByBuyer / itemsByCreative）、`client/src/pages/scorecard.tsx`（ScorecardTable、兩區塊） |
| lifecycle 排序 | `server/routes.ts`（creative-lifecycle 計算 priority、items.sort） |
| Lucky 一鍵任務 | `server/routes.ts`（POST /api/dashboard/lucky-tasks/batch）、`client/src/pages/creative-lifecycle.tsx`（createLuckyTasksMutation、按鈕） |
