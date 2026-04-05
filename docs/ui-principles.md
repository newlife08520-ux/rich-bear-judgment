# UI 設計原則（Tactical Clean / Phase 8）

## 核心美學

「會賺錢的管理系統」— 乾淨、專業、Stripe / Vercel / Linear 等級的 B2B SaaS 質感。避免大面積粉彩底與雜亂語意色。

## 主題與底色

- Light 為主；Dark 類名可保留以相容 shadcn，視覺仍以淺色為準。
- **頁面底**：Slate 中性淺灰（≈ `slate-50`），對應 `:root` 的 `--background: 210 40% 98%`。
- **卡片**：白底、細邊框、輕陰影；標準組合見下方「卡片規範」。
- **品牌主色**：Indigo（`--primary` / `indigo-600` 系），不用傳統「純藍 primary」當語意色。

## CSS 變數（`client/src/index.css` :root 摘要）

```
--background: 210 40% 98%      // ≈ slate-50 頁面底
--foreground: 222 47% 11%
--card: 0 0% 100%
--primary: 243 75% 58%        // indigo 品牌
--muted / muted-foreground: 柔灰階
--border / card-border: slate 系淺邊
--destructive: `346.8 77.2% 49.8%`（rose-600 等效，錯誤／嚴重）；`.dark` 內略調亮以利對比
```

`--status-*` 十六進位色在 `index.css` 已對齊 emerald／rose／amber／indigo（沉睡與資訊共用 indigo 系）。完整變數以 `index.css` 為準。

## 四色語意體系

所有**狀態與資料解讀**（文字、圖示、左框、淺色底、非 Badge 的強調）統一使用下列四色，**不**再混用 raw `red` / `green` / `blue` / `sky` / `orange` / `yellow` 等於語意層。

| 語意 | Tailwind 主色 | 用途 |
|------|----------------|------|
| 正面／成功／獲利 | **emerald** | 達標、上升、OK、賺 |
| 警告／注意 | **amber** | 待確認、疲勞、觀察 |
| 危險／虧損／嚴重 | **rose** | 止損、錯誤、下跌、關閉建議 |
| 資訊／機會／擴量 | **indigo** | 提示、可擴量、中性資訊強調 |

### 類型色（模組識別）

- `creative`：可用 violet 等作**區塊識別**時再約定；語意狀態仍遵守四色。
- `landing_page`、`fb_ads`、`ga4_funnel` 等：以邊框／標題層級辨識為主，避免與四色語意衝突。

### 中性色

- **slate**：次要文字、邊框、表格、低信心說明等，優先於 `gray`。

## Badge 規範

- 所有 **Badge**（含 `variant="outline"` 自訂色）應帶邊框：**`border border-{色}-200`**（dark 下可用 `dark:border-{色}-800/50` 等對應）。
- 影響等級、建議動作等 Badge 的**底色＋文字色**應對齊四色（rose / emerald / amber / indigo），與 `severity-badge`、`recommendation-badge` 等元件一致。

## 禁止清單（語意色）

下列色名**不應**用於表達狀態或資料好壞（Badge 與非 Badge 皆然）：

`violet`、`purple`、`orange`、`yellow`、`cyan`、`teal`、`sky`、`pink`、`green`、`blue`、`red`（請改用上表四色對應）。

例外：微型圖表內 SVG 色段、第三方套件無法覆寫處，可暫留。

## 語意工具類（`index.css`）

專案可定義 `.semantic-danger`、`.semantic-opportunity` 等工具類；其實色應對應 **rose / indigo** 等，與本文件一致。

## 文字規則

- UI 文案：**100% 繁體中文**；避免開發用英文殘留與內部代號當使用者可見字串。
- 不使用 emoji。
- 標題：`font-semibold` / `font-bold`；次要說明：`text-muted-foreground`。
- 數值：等寬字體（`font-mono` / tabular-nums）視情境使用。

## 卡片規範

標準卡片外觀：

`bg-white shadow-sm rounded-xl border border-slate-200 p-5`

（與 shadcn `Card` 組合時，內層 `CardContent` 至少 **`p-5`** 於主要指標／列表卡。）

## Metrics Label 排版

- 主要指標、KPI、摘要格子的標籤建議：**`text-[11px]` 或 `text-xs` + `uppercase tracking-wider` + `text-muted-foreground`**，與儀表板／預算區塊對齊。

## 元件與技術棧

- shadcn/ui、lucide-react、Tailwind CSS。
- 圖表：recharts 等；色票與四色體系一致為佳。

## 互動與無障礙

- 互動元素加 `data-testid`（依專案慣例）。
- 載入：`Skeleton`；提交中：`disabled` + spinner。

## 側欄與路由

- 側欄與設定可見性依角色；實作見 `app-sidebar.tsx`、`auth` 等。
- 404：中文化標題與說明、`Link` 返回首頁（見 `not-found.tsx`）。

## 列印

- `.no-print`、`.print-area` 等類別依現有全域樣式。

## 相關檔案

- `client/src/index.css` — 全域變數與語意類別
- `tailwind.config.ts` — Tailwind 設定
- `client/src/components/shared/status-colors.ts` — 狀態色映射
- `client/src/components/app-sidebar.tsx` — 側欄
