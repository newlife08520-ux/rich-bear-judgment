# AI 行銷審判官 | 數據戰情室

## Overview
The AI Marketing Judge Dashboard is a SaaS platform designed to provide comprehensive marketing performance analysis using AI. It features four judgment modules, layered reports, and a structured case submission system. The core purpose is to analyze real Meta and GA4 data, providing actionable insights through a proprietary scoring system (ScoringResult: health, urgency, opportunity, confidence), detailed diagnoses (12 types), and recommended actions (12 types), all powered by Google Gemini AI. The platform aims to offer a 100% Traditional Chinese UI with a warm, Notion-style light theme.

## User Preferences
- The UI should be 100% Traditional Chinese.
- The design should adhere to a warm light theme, similar to Notion (off-white/beige background, white cards, blue primary accents).
- Do not use border-l-4 on Card components; instead, use `bg-amber-50/50 border-amber-200` for accents.
- No dark mode is desired.
- Emojis should not be used in the UI.

## System Architecture

### UI/UX Decisions
The application uses a light warm theme with specific color palettes (off-white/beige background, white cards, blue primary). It leverages `shadcn/ui` for UI components and `lucide-react` for icons, aiming for a clean, consistent aesthetic.

### Technical Implementations
The frontend is built with React (Vite), Tailwind CSS for styling, Recharts for data visualization (including RadarChart), and Framer Motion for animations. The backend uses Express.js with TypeScript and session-based authentication. Data persistence is handled via in-memory storage (`MemStorage`) with file-based persistence for settings, synced accounts, favorites, and the latest analysis batch. PDF export functionality is provided by `jspdf`.

### Feature Specifications
- **Scoring System (V2)**: Replaces TriScore with `ScoringResult` which includes four scores: Health, Urgency, Opportunity, and Confidence.
- **Diagnosis and Recommendations**: Integrates 12 `DiagnosisType` and 12 `RecommendedAction` types.
- **Board Engine**: Features 6 distinct boards (`dangerBoard`, `stopLossBoard`, `opportunityBoard`, `scaleBoard`, `priorityBoard`, `leakageBoard`) for categorizing insights.
- **Data Fetching**: Supports adset/ad level data from Meta and landing page dimensions from GA4.
- **Policy System**: Binds different operational modes (A/B/C/D) to specific Decision Engine outputs.
- **Unified State Management**: A single state (`useAppScope` hook) manages scope, selection, and date range across all pages.
- **Data Pipeline**: A multi-batch storage system with scope-based keys and LRU eviction for analysis results.
- **AI Integration**: Utilizes Google Gemini API (`@google/generative-ai`) for sophisticated AI analysis and strategic summaries.
- **Anomaly Detection**: The `analysis-engine` focuses solely on detecting anomalies (e.g., ROAS drop, CPC spike).
- **Authentication**: Session-based authentication using `express-session`.

### System Design Choices
- **Persona Brain**: Acts as a prompt-builder, defining "how to say it" through a prompt layer.
- **Decision Engine**: Core computational unit for "how to compute and judge," generating `ScoringResult`, `Diagnosis`, `Recommendation`, and `BoardSet`.
- **Policy System**: Prevents overlap between different operational modes by binding them to specific Decision Engine outputs.
- **Data Persistence**: Uses `.data/*.json` files for essential configurations and user-specific data.
- **Real Data Focus**: All data endpoints read from the latest analysis batch; no mock fallbacks in production paths. Empty states are displayed if no data exists.
- **AI Summary Pipeline**: System first computes KPI/anomaly/priority candidates, then sends structured "決策資料包" to Gemini 3.1 for final judgment, with a deterministic fallback if the API key is absent.
- **Date Range Management**: Unified `resolveDateRange()` function ensures consistent date presets and custom date handling across the application.

## External Dependencies
- **AI**: Google Gemini API (`@google/generative-ai`)
- **Meta Marketing API**: For fetching Facebook Ads campaign and insights data.
- **Google Analytics Data API (GA4)**: For fetching GA4 funnel and page-level data.
- **express-session**: For session-based authentication.
- **jspdf**: For PDF export functionality.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework.
- **Recharts**: React charting library.
- **Framer Motion**: Animation library for React.
- **shadcn/ui**: UI component library.
- **lucide-react**: Icon library.
- **TanStack Query**: For data fetching, caching, and state management.

## Phase E: V2 Scoring Full Wiring (Completed)
- **BoardEntry.listingReason**: Each board entry includes a human-readable `listingReason` string citing diagnosisLabel, actionLabel, relevant V2 scores, benchmarkBasis, timeWindowBasis, and confidence warnings.
- **buildDeterministicSummary V2-aware**: When V2 scored campaigns exist, the deterministic summary includes V2 diagnosis distribution, top urgent campaign with benchmarkBasis/timeWindowBasis, top opportunity, and confidence warnings.
- **buildTodayVerdict V2-enhanced**: Fallback verdict includes V2 top urgent/opportunity campaigns with diagnosis and benchmark context.
- **urgentActions/weeklyRecommendations V2**: When V2 data available, urgentActions reference diagnosisLabel/actionLabel/scores; weeklyRecommendations.today/budgetAdvice/opportunityActions all use V2 scoring.
- **Frontend V2 UI**: All three pages (dashboard, fb-ads, ga4-analysis) show V2 components (V2ScoreMini, DiagnosisBadge, ActionBadge, BenchmarkInfo, V2ScoreBar, ScoringInline) when `scoring` field exists, with graceful fallback to TriScore/RiskLevel.
- **BoardsSection**: Dashboard displays 危險警報/擴量機會/漏斗漏洞 columns with listingReason text per entry.

## Phase F: Product Fix & Usability Pack (Completed)
- **T001**: Judgment page submit/error handling/result display fixed (animation+API sync, error toasts, inline errors)
- **T002**: GA4 funnel anomaly fix — clampRate/safeDropRate helpers; sessionToPageRate clamped; bounceRate non-negative
- **T003**: Board mapping fix — dangerBoard excludes healthy/scaling_ready, requires urgency>=60+health<50; opportunityBoard requires health>=50
- **T004**: Meta API adset/ad level — fetchMetaAdSetAndAdData, AdSetMetrics/AdMetrics interfaces, CampaignStructure with level/parentId
- **T005**: Budget recommendation enhancement — suggestedChange, suggestedAmount, safetyPace, guardConditions, rollbackCondition, confidenceScore computed per recommendation
- **T006**: V2 score display redesign — labeled numbers + color bars ("健康 83 / 急迫 55 / 機會 50 / 信心 100")
- **T007**: Summary humanization — verdict now has headline + "今天先做" + "本週加碼" + "先不要動" structured lines
- **T008**: Number format standardization — CTR/CVR 2dp, ROAS 2dp, CPC 1dp, CPM integer
- **T009**: GA4 page-level recommendations — getPageRecommendation with 6 diagnosis types, PageRecommendationCard in expanded rows
- **T010**: Funnel node drill-down — buildFunnelDrillDown generates top-5 pages per funnel stage, expandable in segment cards
- **T011**: Table layout optimization — reordered columns (ROAS/judgment left, secondary right), name wrapping via line-clamp-2
- **T012**: Visual hierarchy — dashboard hero summary splits into colored action lines (red=today, green=scale, blue=don't touch)

### Post-Phase F Bug Fixes
- **bounceRate unit normalization**: `getPageRecommendation()` in scoring-engine.ts now normalizes bounceRate with `const br = page.bounceRate > 1 ? page.bounceRate : page.bounceRate * 100` to handle both 0-1 and 0-100 inputs safely
- **Funnel visualization clamping**: All funnel stage rates clamped with `Math.min(100, ...)` and drop rates with `Math.max(0, ...)` in ga4-analysis.tsx
- **buildFunnelDrillDown threshold fix**: Changed bounceRate threshold from `> 0.4` to `> 40` since input `GA4PageMetricsDetailed` pages have bounceRate already in 0-100 percentage form
- **Import cleanup**: Replaced dynamic `require("./real-data-transformers")` with static import for `buildFunnelDrillDown` in routes.ts

### Data Unit Convention
- **bounceRate in GA4PageMetricsDetailed**: Always in **percentage form (0-100)**, computed as `((sessions - pageviews) / sessions) * 100`
- **bounceRate from raw GA4 API**: In **decimal form (0-1)**; any code using raw API data must multiply by 100
- **All funnel rates (productViewRate, addToCartRate, etc.)**: In **percentage form (0-100)**

## Phase G: Product Information Architecture Restructure (Completed)
- **T001**: Sidebar navigation restructured — 6 items: 戰情總覽/FB帳號分析/GA頁面分析/內容審判/歷史紀錄/設定中心
- **T002**: Content judgment page input area rebuilt — unified drag-drop zone, purpose/depth pills, supplementary notes
- **T003**: Content judgment 5-section result display — oneLineVerdict/keyPoints/fullAnalysis/nextActions/followUpSuggestions
- **T004**: Content judgment backend — new `/api/content-judgment/start` endpoint, auto-detection, ContentJudgmentResult schema
- **T005**: FB Ads enhanced summary cards — 9 metrics (花費/營收/ROAS/CPA/CPC/CTR/CVR/危險數量/可擴量數量) with change indicators
- **T006**: FB Ads budget & stop-loss — whyNow/risks/paceDescription for budget recs; timeWindow/benchmark/sustainedPattern/possiblePageIssue for stop-loss; creative opportunity filtering
- **T007**: FB Ads campaign/adset/ad structure — 3-level toggle with filters (全部/啟用中/已投放/高花費/高風險), improved empty states
- **T008**: GA4 asset switching — 官網/一頁式/全站 views with per-view page group defaults
- **T009**: GA4 enhanced page list — diagnostic columns, drill-down, page recommendations
- **T010**: Settings simplification — 3 front-facing pill toggles, collapsible advanced section
- **T011**: Date logic unification — 今天/昨天/近3天/近7天/近14天/近30天/自訂 presets
- **T012**: Visual polish — director-voice section titles, content-readable max-width, table-scroll-container, semantic color classes
- **T013**: Persona scope enforcement — scoring-engine.ts has no persona influence (verified clean)

### Phase G Key Schema Changes
- **ContentJudgmentResult**: { oneLineVerdict, keyPoints[], fullAnalysis[{title,content}], nextActions[{label,description}], followUpSuggestions[] }
- **ContentJudgmentInput**: { purpose, depth, notes?, url?, text?, detectedType? }
- **FbBudgetRecommendation**: Added whyNow, risks[], paceDescription
- **StopLossResult**: Added timeWindow, benchmark, sustainedPattern, possiblePageIssue
- **Sidebar title**: "AI 行銷總監" / "你的數據幕僚"