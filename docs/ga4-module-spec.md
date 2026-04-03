# GA4 漏斗模組規格

## 模組定位
分析官網轉換漏斗，比較不同頁面導購率，找出最大掉單點，判斷是否該修頁面或加流量。

## 分析模式 (analysisModes.ga4_funnel)

| ID | Label | 說明 |
|----|-------|------|
| funnel_health | 整體漏斗健康度 | 全面漏斗診斷 |
| biggest_drop | 找最大掉單點 | 找出流失最嚴重的環節 |
| page_compare | 比較不同頁面導購率 | 頁面間效能比較 |
| fix_or_traffic | 判斷是否該修頁面或加流量 | 決策建議 |
| checkout_friction | 結帳流程阻力分析 | 結帳環節診斷 |

## 資料型別

### GA4PageMetrics
```typescript
{
  id: string;
  pageName: string;              // 頁面名稱
  path: string;                  // 頁面路徑
  sessions: number;              // 工作階段數
  users: number;                 // 使用者數
  avgDuration: number;           // 平均停留秒數
  bounceRate: number;            // 跳出率 (%)
  productViewRate: number;       // 商品瀏覽率 (%)
  addToCartRate: number;         // 加入購物車率 (%)
  checkoutRate: number;          // 開始結帳率 (%)
  purchaseRate: number;          // 購買率 (%)
  overallConversionRate: number; // 整體轉換率 (%)
  aiLabel: string;               // AI 標籤
  aiComment: string;             // AI 評語
}
```

### GA4DropPoint
```typescript
{
  stage: string;      // 階段名稱
  issue: string;      // 問題描述
  severity: "critical" | "high" | "medium";
  fix: string;        // 修正建議
}
```

### GA4PageRanking
```typescript
{
  pageName: string;
  path: string;
  conversionRate: number;
  recommendation: "add_traffic" | "fix_first" | "use_as_template" | "monitor";
  reason: string;
}
```

## API 端點

| Method | Path | 說明 |
|--------|------|------|
| GET | /api/ga4/pages?accountId=X&search=Q | 頁面指標列表（可搜尋） |
| GET | /api/ga4/drop-points?accountId=X | 漏斗掉單點 |
| GET | /api/ga4/page-ranking?accountId=X | 頁面排名（按轉換率） |

## AI 標籤分類

| aiLabel | 條件 | 建議 |
|---------|------|------|
| 最值得加流量 | 導購率高但流量少 | 增加流量 |
| 流量有但接不住 | 流量大但轉換率低 | 先修頁面 |
| 適合當模板 | 各指標均衡優秀 | 作為參考範本 |
| 首屏要修 | 跳出率高、停留短 | 重做首屏 |
| 結帳前掉最兇 | 加購到結帳掉單嚴重 | 修結帳流程 |
| 不適合導購 | 停留長但導購率極低 | 不作為銷售入口 |

## 頁面排名建議類型

| recommendation | 中文 | 說明 |
|---------------|------|------|
| add_traffic | 加流量 | 頁面已經很好，缺流量 |
| fix_first | 先修再加流量 | 頁面有問題，修好再投 |
| use_as_template | 作為模板 | 結構值得其他頁面學習 |
| monitor | 持續觀察 | 維持現狀即可 |

## Mock 資料
- 7 個頁面記錄（storage.ts 內 getGA4Pages）
- 5 個掉單點（getGA4DropPoints）
- 7 個頁面排名（getGA4PageRanking）

## 審判頁面表單 (ga4_funnel 類型)
- GA4 資源選擇器 (Select)
- 日期範圍選擇器 (Select)
- 搜尋輸入框 (Input)
- 分析模式下拉選單 (Select, 從 analysisModes.ga4_funnel)
- 補充說明 (Textarea)

## 報告結構 (Mode D 輸出)
- diagnosis: landingPageEfficiency, productPageConversion, cartAbandonment, checkoutFriction, overallFunnelHealth
- extras: funnelBreakpoints[], pageFixIdeas[], checkoutFixes[], trafficAdvice

## 目前狀態
- [x] Schema 型別定義
- [x] Mock 資料 (7 頁面 + 5 掉單點 + 7 排名)
- [x] API 端點 (3 個)
- [x] 審判頁表單 (分析模式下拉)
- [x] 審判報告渲染 (Summary + Detail)
- [ ] 獨立 GA4 頁面比較視圖（頁面排名表格、掉單點卡片）
- [ ] 頁面間視覺比較（長條圖/雷達圖）
- [ ] 漏斗視覺化

## 相關檔案
- `shared/schema.ts` - GA4PageMetrics, GA4DropPoint, GA4PageRanking
- `server/storage.ts` - getGA4Pages, getGA4DropPoints, getGA4PageRanking
- `server/routes.ts` - /api/ga4/* 端點
- `client/src/pages/judgment.tsx` - ga4_funnel 表單區塊
