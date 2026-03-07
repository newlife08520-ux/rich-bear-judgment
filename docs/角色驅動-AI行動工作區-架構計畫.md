# 角色驅動的 AI 行動工作區 — 架構設計與實作計畫

本文為「從老闆視角帳號報表 → 角色驅動行動工作區」的底層架構計畫，**不涉及大量前端 UI 實作**，僅定義 Schema、API/演算法與 GA4 對接方向，供確認後分階段動工。

---

## 一、階段一：角色與負責商品 (RBAC & Assignment)

### 1.1 目前狀態

- **User**（`shared/schema.ts`）：`id`, `username`, `password`, `role`（`admin` | `manager` | `user`）, `displayName`
- 資料儲存：目前多數模組使用 **JSON 檔案**（`.data/*.json`），`drizzle.config.ts` 指向 PostgreSQL，但實際讀寫多為 file-based，需確認 User 是否已入庫或仍為檔案

### 1.2 Schema 修改建議（結構草稿）

無論採用「純 TypeScript 介面 + JSON 存檔」或「Drizzle/Prisma + DB」，建議邏輯結構如下。

#### A. 角色枚舉擴充（與既有 `userRoles` 二選一或並存過渡）

```ts
// 新角色：依「視角」區分，與既有 admin/manager/user 可並存或取代
export const workRoles = ["ADMIN", "MEDIA_BUYER", "MARKETER", "DESIGNER"] as const;
export type WorkRole = (typeof workRoles)[number];

export const workRoleLabels: Record<WorkRole, string> = {
  ADMIN: "管理員",
  MEDIA_BUYER: "投手",
  MARKETER: "行銷",
  DESIGNER: "設計",
};
```

- 若保留既有 `admin`/`manager`/`user`：可新增 `workRole?: WorkRole`，登入後依 `workRole` 決定 Action Center 視角；若未填則依 `role === "admin"` 視為 ADMIN。
- 若全面改用新角色：將 `userRoles` 改為上述 `workRoles` 並做一次資料遷移。

#### B. 負責商品：兩種實作擇一

**方案一：User 欄位內嵌（簡單、無需新表）**

```ts
export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;           // 既有
  workRole?: WorkRole;      // 新增：ADMIN | MEDIA_BUYER | MARKETER | DESIGNER
  displayName: string;
  /** 負責商品名稱列表，與 Campaign 解析出的「產品名」對齊，例如 ["小淨靈", "香水"] */
  assignedProductNames: string[];  // 新增；ADMIN 可留空表示看 All
}
```

- 優點：無新表、查詢簡單（登入後直接讀 `assignedProductNames`）。
- 缺點：商品名稱變更時需批次更新所有 User。

**方案二：關聯表（可擴充權限與審核）**

```ts
// 商品主檔（可選，若希望商品為正式實體）
export interface Product {
  id: string;
  name: string;             // 與廣告命名「產品名」一致，如 "小淨靈"
  displayOrder?: number;
  createdAt: string;
}

// 使用者－商品 分配
export interface UserProductAssignment {
  id: string;
  userId: string;
  productId: string;        // 若用 Product 表
  // 或 productName: string;  // 若不用 Product 表，直接存字串
  assignedAt: string;
}
```

- 查詢：登入後依 `userId` 查 `UserProductAssignment` 得到 `productId` 或 `productName` 列表，再與聚合引擎的「產品名」對齊。
- 優點：可擴充審核、生效日等；缺點：多一張表與 API。

**建議**：第一版採 **方案一**（`User.workRole` + `User.assignedProductNames`），ADMIN 且 `assignedProductNames` 為空或含特殊值（如 `"*"`）時，Dashboard 預設「全部商品」並保留下拉「看 All」；其餘角色預設只 Query/顯示 `assignedProductNames` 內產品。

### 1.3 Dashboard 預設過濾

- **API 層**：所有「戰情 / 商品級 / 標籤級」查詢多一個參數 `scopeProducts?: string[]`。
  - 若呼叫端為 ADMIN 且選擇「全部」：不傳或傳 `[]` 表示不依產品過濾。
  - 若為一般角色或 ADMIN 選了「我的負責」：傳入該使用者的 `assignedProductNames`。
- **前端**：登入後讀取 `user.workRole`、`user.assignedProductNames`，預設只顯示負責商品；ADMIN 顯示「全部 / 我的負責」下拉，切換時改傳 `scopeProducts`。

---

## 二、階段二：商品與標籤的數據聚合引擎 (Tag Aggregation Engine)

### 2.1 命名規範（與既有 SOP 一致）

- **Campaign / Ad Set 名稱**：`[活動目標](原始)[MMDD]-[產品名]-[素材策略]+[文案簡稱]-[受眾代碼]`  
  例：`轉換次數(原始)0305-小淨靈-3影K+抓住文-T`
- **Ad 名稱**：`(原)混[素材組名]+[文案簡稱]` 或 `[素材組名]+[文案簡稱]`  
  例：`(原)混A版+抓住文`、`A版+痛點文`

### 2.2 解析與聚合：Regex 萃取虛擬標籤

以下為 **虛擬示範**：從 Campaign/Ad 名稱萃取出「產品名、素材策略、文案簡稱」（與部分 Ad 的「素材組名」），再依產品 / 標籤聚合。

```ts
// ========== 階段二：Tag Aggregation Engine（示範邏輯） ==========

export interface ParsedCampaignTags {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  audienceCode: string;
  raw: string;
}

const CAMPAIGN_NAME_REGEX =
  /^(.+?)(\d{4})-([^-]+)-([^-]+)\+([^-]+)-(.+)$/;
//  [ 目標前綴  ][MMDD]-[產品名]-[素材策略]+[文案簡稱]-[受眾代碼]

export function parseCampaignNameToTags(campaignName: string): ParsedCampaignTags | null {
  if (!campaignName || typeof campaignName !== "string") return null;
  const m = campaignName.trim().match(CAMPAIGN_NAME_REGEX);
  if (!m) return null;
  return {
    productName: m[3]!.trim(),
    materialStrategy: m[4]!.trim(),
    headlineSnippet: m[5]!.trim(),
    audienceCode: m[6]!.trim(),
    raw: campaignName,
  };
}

export interface ParsedAdTags {
  groupDisplayName: string;
  headlineSnippet: string;
  isMixedRatio: boolean;
  raw: string;
}

const AD_NAME_REGEX_MIXED = /^\(原\)混(.+?)\+(.+)$/;
const AD_NAME_REGEX_SINGLE = /^(.+?)\+(.+)$/;

export function parseAdNameToTags(adName: string): ParsedAdTags | null {
  if (!adName || typeof adName !== "string") return null;
  const mixed = adName.trim().match(AD_NAME_REGEX_MIXED);
  if (mixed)
    return {
      groupDisplayName: mixed[1]!.trim(),
      headlineSnippet: mixed[2]!.trim(),
      isMixedRatio: true,
      raw: adName,
    };
  const single = adName.trim().match(AD_NAME_REGEX_SINGLE);
  if (single)
    return {
      groupDisplayName: single[1]!.trim(),
      headlineSnippet: single[2]!.trim(),
      isMixedRatio: false,
      raw: adName,
    };
  return null;
}

// ---------- 聚合：跨帳號「商品級」 ----------

export interface ProductLevelMetrics {
  productName: string;
  accountIds: string[];
  campaignIds: string[];
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  conversions: number;
  frequency: number;
  campaignCount: number;
  /** 用於 Hidden Gems：總花費或頻率偏低但 ROAS 高 */
  spendShare?: number;
  avgRoasAcrossProducts?: number;
}

export function aggregateByProduct(
  campaignMetrics: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; revenue: number; roas: number; impressions: number; clicks: number; conversions: number; frequency: number }>,
  scopeProducts?: string[]
): ProductLevelMetrics[] {
  const byProduct = new Map<string, ProductLevelMetrics>();

  for (const row of campaignMetrics) {
    const tags = parseCampaignNameToTags(row.campaignName);
    if (!tags) continue;
    if (scopeProducts != null && scopeProducts.length > 0 && !scopeProducts.includes(tags.productName)) continue;

    const key = tags.productName;
    const existing = byProduct.get(key);
    if (!existing) {
      byProduct.set(key, {
        productName: key,
        accountIds: [row.accountId],
        campaignIds: [row.campaignId],
        spend: row.spend,
        revenue: row.revenue,
        roas: row.roas,
        impressions: row.impressions,
        clicks: row.clicks,
        conversions: row.conversions,
        frequency: row.frequency,
        campaignCount: 1,
      });
    } else {
      existing.spend += row.spend;
      existing.revenue += row.revenue;
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.conversions += row.conversions;
      if (!existing.accountIds.includes(row.accountId)) existing.accountIds.push(row.accountId);
      existing.campaignIds.push(row.campaignId);
      existing.campaignCount += 1;
      existing.roas = existing.spend > 0 ? existing.revenue / existing.spend : 0;
      existing.frequency = existing.impressions > 0 ? existing.impressions / (existing.clicks || 1) : existing.frequency;
    }
  }

  return Array.from(byProduct.values());
}

// ---------- 聚合：同產品下「素材策略 × 文案簡稱」勝率榜 ----------

export interface CreativeTagLevelMetrics {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  cpa: number;
  campaignCount: number;
}

export function aggregateByCreativeTags(
  campaignMetrics: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; revenue: number; roas: number; conversions: number }>,
  scopeProducts?: string[]
): CreativeTagLevelMetrics[] {
  const byTag = new Map<string, CreativeTagLevelMetrics>();

  for (const row of campaignMetrics) {
    const tags = parseCampaignNameToTags(row.campaignName);
    if (!tags) continue;
    if (scopeProducts != null && scopeProducts.length > 0 && !scopeProducts.includes(tags.productName)) continue;

    const key = `${tags.productName}\t${tags.materialStrategy}\t${tags.headlineSnippet}`;
    const cpa = row.conversions > 0 ? row.spend / row.conversions : 0;
    const existing = byTag.get(key);
    if (!existing) {
      byTag.set(key, {
        productName: tags.productName,
        materialStrategy: tags.materialStrategy,
        headlineSnippet: tags.headlineSnippet,
        spend: row.spend,
        revenue: row.revenue,
        roas: row.roas,
        conversions: row.conversions,
        cpa,
        campaignCount: 1,
      });
    } else {
      existing.spend += row.spend;
      existing.revenue += row.revenue;
      existing.conversions += row.conversions;
      existing.campaignCount += 1;
      existing.roas = existing.spend > 0 ? existing.revenue / existing.spend : 0;
      existing.cpa = existing.conversions > 0 ? existing.spend / existing.conversions : 0;
    }
  }

  return Array.from(byTag.values());
}
```

- **Hidden Gems**：在 `ProductLevelMetrics[]` 上計算全體平均 ROAS、總花費佔比；篩選「ROAS > 平均、CPA 低、花費/頻率極低」的產品，標記為「強烈建議擴量」。
- **素材與文案勝率榜**：使用 `aggregateByCreativeTags` 的結果，同產品下比較 [抓住文] vs [痛點文]、[3影K] vs [單圖] 的 CPA/ROAS 排序即可。

### 2.3 API 架構建議

- **輸入**：沿用現有拉取 FB Campaign/Ad 的 pipeline，產出 `CampaignMetrics[]`（及可選 `AdMetrics[]`）。
- **新 Service**：例如 `TagAggregationService`：
  - `getProductLevelMetrics(accountIds, dateRange, scopeProducts?)` → 先取 Campaign 級數據，再 `aggregateByProduct(..., scopeProducts)`。
  - `getCreativeLeaderboard(productName?, scopeProducts?, dateRange)` → `aggregateByCreativeTags(...)` 後排序。
  - `getHiddenGems(scopeProducts?, dateRange)` → 依商品級聚合結果套用 Hidden Gems 規則，回傳建議擴量清單。
- **權限**：上述 API 的 `scopeProducts` 由登入者 `assignedProductNames` 或 ADMIN 選擇決定。

---

## 三、階段三：戰情總覽改版為「今日行動中心」(Action Center)

（僅列邏輯與資料需求，不寫 UI 實作）

- **投手視角**：顯示「急需關閉」（高花費無轉換，可由既有 RiskyCampaign / 異常邏輯 + `scopeProducts` 過濾）與「潛力爆款」（Hidden Gems）。
- **行銷視角**：顯示各產品的「文案勝率榜」（Creative Leaderboard，素材策略 × 文案簡稱）。
- **設計視角**：顯示「素材策略排行榜」（高 CTR、前三秒留存等，若 API 有回傳），並依素材疲勞度給「急需補檔建議」。
- **實作要點**：同一套 API（商品級、標籤級、Risky/HiddenGems），依 `user.workRole` 決定首頁要請求哪幾支 API、顯示哪幾類 Action Cards；ADMIN 可看全部或切換為「我的負責」。

---

## 四、階段四：打通 FB 與 GA4 的斷點 (Funnel Stitching)

### 4.1 建稿端強迫加 UTM

- 在【投放中心】送出建立草稿（或批次建稿）時，在 `landingPageUrl` 上**強制附加 UTM**（若網址已有 query，則用 `&` 銜接）：
  - `utm_source=meta`
  - `utm_medium=cpc`（或依實際）
  - `utm_campaign=[產品名]`（與命名規範的產品名一致）
  - `utm_content=[素材策略]+[文案簡稱]`（與 Campaign 解析標籤一致，方便 GA4 維度對齊）
  - 可選：`utm_term=[受眾代碼]`
- 實作位置：`PublishDraft` 寫入前或 Meta 送出前，由後端/前端在 `landingPageUrl` 上 append 上述參數（產品名、素材策略、文案簡稱、受眾代碼來自表單或命名引擎輸出）。

### 4.2 漏斗整合架構（Data Interface）

- **左側 (Top-funnel)**：現有 FB 數據（Spend, Outbound Clicks, 若可行再加 Impressions）。依 **Campaign 名稱解析** 得到 `productName`、`materialStrategy`、`headlineSnippet`，與 UTM 對齊時以 `utm_campaign = 產品名`、`utm_content = 素材策略+文案簡稱` 為鍵。
- **右側 (Bottom-funnel)**：**Google Analytics Data API (GA4)** 查詢：
  - 維度：`sessionCampaignName`（GA4 對應 utm_campaign）、可選 `sessionDefaultChannelGroup` 或自訂維度（若有用 `utm_content` 存成自訂維度）。
  - 指標：Sessions, AddToCart, Purchase, Bounce Rate, 可選 Average Engagement Time。
  - 篩選：`sessionCampaignName = [產品名]`（或依日期區間內有流量的 campaign 列表動態查）。
- **對接方式**：同一「產品名」下，左側彙總該產品所有 Campaign 的 Spend / Clicks，右側彙總 GA4 中 `utm_campaign = 產品名` 的 Sessions / AddToCart / Purchase / Bounce Rate；產出「單一產品維度」的合併報表（例如 `ProductFunnelRow`: productName, spend, clicks, sessions, addToCart, purchase, bounceRate）。

### 4.3 利用 Google Analytics Data API (GA4) 搭配 UTM 的實作要點

1. **認證**：使用 GA4 的 Service Account 或 OAuth 2.0，取得 access token 後呼叫 [Google Analytics Data API (GA4)](https://developers.google.com/analytics/devguides/reporting/data/v1)。
2. **RunReport 請求**：
   - `dimensions`: `sessionCampaignName`（對應 utm_campaign）、可選 `sessionSourceMedium` 或自訂維度（utm_content）。
   - `metrics`: `sessions`, `addToCartEvents`, `purchases`, `bounceRate`（或對應 GA4 指標名稱）。
   - `dimensionFilter`: `sessionCampaignName` 等於指定產品名（或 IN 多個產品名），以對齊 FB 側的「產品名」。
   - `dateRange`: 與 FB 報表區間一致。
3. **紅綠燈診斷**：在合併後的 ProductFunnelRow 上實作規則，例如：
   - FB CTR > 3% 且 GA4 Bounce Rate > 80% → 「素材騙點擊或落地頁體驗差，建議優化落地頁」。
   - FB Clicks 高、GA4 Sessions 明顯偏低 → 追蹤或 UTM 遺失，發出檢查 UTM/埋碼提醒。
   - 可再結合既有 Anomaly 類型（如 `ga_meta_mismatch`）寫入診斷結果供 Action Center 顯示。

### 4.4 小結（階段四）

- **建稿端**：強制 UTM（`utm_campaign=[產品名]`, `utm_content=[素材策略]+[文案簡稱]`）。
- **數據層**：FB 側依 Campaign 名稱解析出產品/標籤；GA4 側依 `sessionCampaignName`（與 utm_campaign 對應）篩選並彙總 Sessions / AddToCart / Purchase / Bounce Rate。
- **介面**：定義 ProductFunnelRow 或 FunnelStitchResult，左 FB、右 GA4，依產品名對齊；紅綠燈邏輯在合併後資料上計算並寫入建議。

---

## 五、Action Items 回覆摘要

| 項目 | 回覆 |
|------|------|
| **1. 階段一 Schema** | 新增 `workRole`（ADMIN/MEDIA_BUYER/MARKETER/DESIGNER）與 `assignedProductNames: string[]` 於 User；不強制新增 Table，採 User 內嵌欄位即可；ADMIN 可選「全部」時不依產品過濾。 |
| **2. 階段二 Aggregation Engine** | 已於 §2.2 提供虛擬 TypeScript：`parseCampaignNameToTags`、`parseAdNameToTags`、`aggregateByProduct`、`aggregateByCreativeTags`；依 Regex 切割廣告名稱並聚合成商品級與標籤級數據；Hidden Gems / Creative Leaderboard 皆可基於上述結構延伸。 |
| **3. 階段四 GA4 + UTM** | 建稿強制 UTM（utm_campaign=產品名、utm_content=素材策略+文案簡稱）；GA4 使用 Data API RunReport，以 sessionCampaignName 等維度篩選產品，彙總 Sessions/AddToCart/Purchase/Bounce Rate；與 FB Spend/Clicks 依產品名對齊後做紅綠燈診斷（如高 CTR + 高 Bounce → 落地頁優化建議）。 |

確認上述邏輯與架構無誤後，可依序進行：階段一 Schema + 登入/權限過濾 → 階段二聚合引擎與 API → 階段三 Action Center UI → 階段四 UTM 與 GA4 對接。
