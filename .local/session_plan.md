# Product Information Architecture Restructure — Phase G

## Objective
Restructure the entire product into a dual-track system:
- **Track A — Structured Data Analysis**: 戰情總覽, FB 帳號分析, GA 頁面分析
- **Track B — Content Judgment**: Unified entry for images/videos/PDF/URL/text

Simplify the frontend experience while maintaining analytical depth. Make it feel like "a very capable marketing director" not "a bunch of forms." 100% Traditional Chinese, warm Notion-style light theme.

# Tasks

### T001: Sidebar Navigation Restructure
- **Blocked By**: []
- **Details**:
  - Restructure sidebar in `app-sidebar.tsx` to 6 items:
    1. 戰情總覽 (/) — LayoutDashboard
    2. FB 帳號分析 (/fb-ads) — Megaphone
    3. GA 頁面分析 (/ga4) — BarChart3
    4. 內容審判 (/judgment) — Gavel
    5. 歷史紀錄 (/history) — History
    6. 設定中心 (/settings) — Settings (admin/manager only)
  - Rename labels to match new IA (數據儀表板→戰情總覽, 審判任務→內容審判)
  - Verify routes in App.tsx still correct
  - Files: `client/src/components/app-sidebar.tsx`
  - Acceptance: Sidebar shows exactly 6 items with correct names/icons

### T002: Content Judgment Page — Input Area Rebuild
- **Blocked By**: []
- **Details**:
  - Redesign `/judgment` page as unified "內容審判" entry
  - **Upper section — left side (main input)**:
    - Large drag-drop zone: "把素材、PDF、網址、文案直接丟給我"
    - Support: image, video, PDF upload; URL paste; text paste
    - Show uploaded file cards / URL preview / text summary
    - Supplementary notes textarea: "你最在意什麼？例如：這頁為什麼不轉？這支影片要不要重拍？"
    - Purpose pills (2): 賣貨 (default) | 品牌
    - Depth pills (2): 快速版 | 完整版 (default)
    - CTA: "開始審判" button
  - **Upper section — right side**:
    - Judgment capability description
    - Quick templates: 4 cards (看素材/看頁面/看廣告帳號/看漏斗) as quick-start shortcuts
    - "看廣告帳號" links to /fb-ads, "看漏斗" links to /ga4
  - Remove ALL complex mode selectors (偏轉換/偏營收/偏創意/偏品牌 dropdowns, analysis mode dropdown)
  - Files: `client/src/pages/judgment.tsx`
  - Acceptance: Clean input with drag-drop, 2 toggles, 1 button; no complex selectors

### T003: Content Judgment Page — 5-Section Result Display
- **Blocked By**: [T002]
- **Details**:
  - Lower section shows results in 5 parts:
    1. **一句總判** — large bold director voice ("這份提案有氣質，但現在還不夠會賣")
    2. **重點整理** — 3-5 bullets (biggest problem, why not selling, what to fix first)
    3. **完整拆解** — auto chapters by content type (death points, copy issues, visual issues, CTA fixes, etc.)
    4. **下一步動作** — action cards ("幫我重寫標題", "幫我改首屏", "幫我做三種投放版本")
    5. **追問區** — follow-up chat with quick-action buttons ("那你直接幫我改", "那影片腳本怎麼拍")
  - Output must feel human and director-like, NOT cold report
  - Files: `client/src/pages/judgment.tsx`
  - Acceptance: 5 distinct result sections visible after judgment completes

### T004: Content Judgment Backend — Auto-Detection & Routing
- **Blocked By**: []
- **Details**:
  - Update `/api/judgment/start` to accept unified input: file(s), URL, text, purpose, depth
  - Auto-detect content type: image→creative, URL→landing page, PDF→proposal, text→copy
  - Route to appropriate internal prompt strategy (Mode A/B/C/D) WITHOUT exposing mode to frontend
  - Only receive purpose (賣貨/品牌) + depth (快速/完整) from frontend
  - Update prompt construction to produce 5-section output format
  - Files: `server/routes.ts`, `server/gemini.ts`, `shared/schema.ts`
  - Acceptance: Backend auto-detects type and applies correct strategy; returns structured 5-section result

### T005: FB Ads Page — Enhanced Summary Cards
- **Blocked By**: []
- **Details**:
  - Redesign top summary to feel like "操盤摘要":
    - Show: 本期總花費, 本期營收, ROAS, CPA, CPC, CTR, CVR, 危險數量, 可擴量數量
  - Human-like headline (e.g., "先別急著加預算，這兩個地方現在最容易漏錢")
  - Files: `client/src/pages/fb-ads.tsx`, `server/real-data-transformers.ts`
  - Acceptance: Summary shows all 9 metrics in conversational presentation

### T006: FB Ads Page — Budget & Stop-Loss Enhancement
- **Blocked By**: []
- **Details**:
  - **Budget recs** must show: % increase, amount, why now, risks, pace (分幾天拉)
    - Example output: "建議先加 15%，觀察 2 天；若 ROAS 維持 > 2.8 再加第二段"
  - **Stop-loss** must show: reason, time window, benchmark, short-term vs sustained, possible page issue
  - **Creative opportunity filtering**: exclude ended too long, low confidence, already stop-loss, low spend/insufficient sample
  - Files: `client/src/pages/fb-ads.tsx`, `server/real-data-transformers.ts`, `server/scoring-engine.ts`
  - Acceptance: Actionable recommendations with specific numbers and reasoning

### T007: FB Ads Page — Campaign/Adset/Ad Structure
- **Blocked By**: []
- **Details**:
  - Structure tab shows real data at campaign/adset/ad levels with level switcher
  - Filter: 啟用中/已投放/高花費/高風險
  - If adset/ad data missing, show explanation ("此帳號尚未取得廣告組/廣告層級數據")
  - Files: `client/src/pages/fb-ads.tsx`
  - Acceptance: Structure tab with 3-level toggle and filter, shows data or explanation

### T008: GA4 Page — Asset Switching & Page Groups
- **Blocked By**: []
- **Details**:
  - First-layer asset switcher: 官網 / 一頁式 / 全站
  - Per-view defaults:
    - 官網: 導購/商品頁/分類頁/FAQ/品牌頁
    - 一頁式: 首屏/信任感/CTA/購物車/結帳
    - 全站: 跨頁總覽與重大異常
  - Second layer: page group → page list → single page drill-down
  - Files: `client/src/pages/ga4-analysis.tsx`
  - Acceptance: 3 asset views with different defaults; drill-down navigation works

### T009: GA4 Page — Enhanced Page List & Drill-Down
- **Blocked By**: [T008]
- **Details**:
  - Page list columns: 頁面標題, 類型, 所屬漏斗階段, 主要問題, 建議動作, 優先級, confidence, 是否影響成交
  - Single page expansion: 問題診斷, 可能原因, 先改哪裡, 建議文案/區塊/CTA/信任/結帳改善
  - Funnel nodes drill-down to top pages with per-page fixes
  - Files: `client/src/pages/ga4-analysis.tsx`, `server/scoring-engine.ts`
  - Acceptance: Full diagnostic columns; expanded view with actionable recommendations

### T010: Settings Page Simplification
- **Blocked By**: []
- **Details**:
  - Front-facing: 3 pill toggles (目的: 賣貨/品牌, 深度: 快速/標準/完整, 語氣: 專業/直接/親切)
  - Advanced (collapsible): 嚴格度, confidence門檻, 保守預算建議, 低信心提示
  - Keep API binding + Pipeline tabs, clean up UI
  - Reduce dropdown count, shorten option text
  - Files: `client/src/pages/settings.tsx`
  - Acceptance: Settings feel like "preferences you'll actually use"

### T011: Date Logic Unification
- **Blocked By**: []
- **Details**:
  - New standard presets: 今天, 昨天, 近3天, 近7天, 近14天, 近30天, 自訂
  - Add "今天" and "昨天" to `DATE_PRESETS` in schema.ts
  - Consistent across dashboard, FB, GA4, judgment
  - 90-day option → advanced only
  - Files: `shared/schema.ts`, `client/src/components/shared/date-range-selector.tsx`
  - Acceptance: All pages show identical 7 date presets

### T012: Visual Polish & Readability
- **Blocked By**: [T001, T002, T005, T008, T010]
- **Details**:
  - Human-like headlines across all pages (not system-speak)
  - Unified card padding, title hierarchy, badge styles
  - Main content max-width (~900px for reading areas, tables separate)
  - Local horizontal scroll for tables, core content fits viewport
  - Color semantics enforced: 紅=danger, 黃=warning, 綠=stable, 藍=opportunity, 灰=low confidence
  - Dashboard hero summary reads like director speaking
  - Files: `client/src/index.css`, all page files
  - Acceptance: Consistent visual language; no system-speak; readable width

### T013: Persona Scope Enforcement
- **Blocked By**: []
- **Details**:
  - Persona affects ONLY: 語氣, 總結風格, 建議呈現方式, 總監感
  - Persona MUST NOT affect: score, risk, 停損邏輯, ranking, 預算建議
  - Verify separation in scoring-engine.ts (no persona influence) and gemini.ts (persona only in prompts)
  - Files: `server/gemini.ts`, `server/scoring-engine.ts`
  - Acceptance: Code review confirms clean separation
