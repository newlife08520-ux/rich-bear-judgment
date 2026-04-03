# UI 設計原則

## 核心美學
「會賺錢的管理系統」— 乾淨、專業、溫暖但有力量。Notion 風格。

## 主題
- 僅 Light mode，無 Dark mode
- 暖色調底色 (off-white/beige)
- 白色卡片
- 藍色主色調 (primary)

## CSS 變數 (index.css :root)
```
--background: 40 20% 97%     // 暖白底色
--foreground: 220 15% 12%    // 深灰文字
--card: 0 0% 100%            // 純白卡片
--primary: 221 83% 53%       // 藍色主色
--muted: 35 10% 93%          // 柔灰色
--muted-foreground: 220 8% 46%  // 次要文字
--border: 30 10% 88%         // 淡灰邊框
--sidebar: 35 15% 95%        // 側欄底色
```

## 色彩語意

### 類型色
- creative: 紫色 (violet)
- landing_page: 藍色 (blue)
- fb_ads: 琥珀色 (amber)
- ga4_funnel: 翠綠色 (emerald)

### 狀態色
- 成功/正面: emerald
- 警告/注意: amber
- 危險/嚴重: red
- 資訊/中性: blue

### 影響等級 Badge
- high: `text-red-700 bg-red-50`
- medium: `text-amber-700 bg-amber-50`
- low: `text-blue-700 bg-blue-50`

### 建議動作 Badge
- launch: `text-emerald-700 bg-emerald-50 border-emerald-200`
- scale: `text-blue-700 bg-blue-50 border-blue-200`
- hold: `text-amber-700 bg-amber-50 border-amber-200`
- stop: `text-red-700 bg-red-50 border-red-200`
- fix_first: `text-orange-700 bg-orange-50 border-orange-200`

## 文字規則
- 100% 繁體中文 UI
- 不使用 emoji
- 標題層次清晰（font-semibold / font-bold）
- 次要文字用 text-muted-foreground
- 數值用等寬字體呈現

## 元件使用
- shadcn/ui 為基礎
- lucide-react 圖示
- react-icons/si 公司 logo
- framer-motion 動畫
- recharts 圖表（RadarChart, BarChart, AreaChart, FunnelChart）
- tailwind CSS 樣式

## 排版原則
- 卡片間距: gap-4 或 gap-6
- 卡片內 padding: p-4 或 p-5
- Section 間距: space-y-6
- 表單欄位間距: space-y-4
- 文字行距: leading-relaxed (次要文字)

## 互動規則
- 按鈕: 所有互動元素加 data-testid
- hover: hover-elevate 類別
- 載入中: Skeleton 元件
- 表單提交: isPending 時 disable + spinner
- Toast: useToast hook

## 側欄
- 角色感知：Settings 對 'user' role 隱藏
- 5 個主要導航項：數據戰情室、審判、歷史、設定、登出

## 列印
- `.no-print` 類別隱藏元素
- `.print-area` 全寬列印區域

## 目前頁面
| 路徑 | 頁面 | 檔案 |
|------|------|------|
| / | 登入 | login.tsx |
| /dashboard | 數據戰情室 | dashboard.tsx |
| /judgment | 審判台 | judgment.tsx |
| /history | 歷史記錄 | history.tsx |
| /settings | 系統設定 | settings.tsx |

## 相關檔案
- `client/src/index.css` - 全域 CSS 變數
- `tailwind.config.ts` - Tailwind 設定
- `client/src/components/app-sidebar.tsx` - 側欄
- `client/src/lib/auth.tsx` - 認證上下文
