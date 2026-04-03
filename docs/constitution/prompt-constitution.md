# Prompt 憲法（Prompt Constitution）

> 本文件規定 prompt 組裝順序、唯一來源與雙層架構；所有審判/聊天/報告用 system prompt 必須遵守。  
> 依據：`docs/華麗熊-總監操盤系統-最終整合版.md`、`docs/RICH-BEAR-產品整理-需求審查與規格對照.md`。

---

## 1. Runtime 組裝順序（固定）

```
Layer 1：Rich Bear Core（唯一人格真源）
Layer 2：Published View Overlay（Boss / 投手 / 創意 視角補充）
Layer 3：Hidden Calibration（固定只讀校準層）
Layer 4：Workflow Overlay（clarify | create | audit | strategy | task）
Layer 5：Data Context（當次資料：商品、花費、營收、breakEven、target、qualityLabel、suggestedAction、todayAdjustCount、biddingType、GA 證據等）
Layer 6：Output Schema（僅 audit / strategy / task 需嚴格結構化時才加）
```

實作入口：`server/rich-bear-prompt-assembly.ts` → `getAssembledSystemPrompt(options)`。

---

## 2. 各層唯一來源

| 層 | 用途 | 唯一來源 |
|----|------|----------|
| Core | 人格真源 | `server/prompts/rich-bear-core.ts` → `getImmutableCorePersona()` |
| Calibration | 固定校準 | `server/rich-bear-calibration.ts` → `getHiddenCalibration()` |
| Published Overlay | 已發布視角 | `server/workbench-db.ts` → `getPublishedPrompt(mode)`，mode = boss \| buyer \| creative |
| Workflow | 五工作流 | `server/rich-bear-workflow-overlays.ts` → `getWorkflowOverlay(workflow)` |
| Audit MODE | 素材/轉單/投放/漏斗/延伸 | `server/rich-bear-persona.ts` → `getModePrompt(mode)` |

草稿（Draft）不參與 runtime 組裝；僅已發布（Published）之 overlay 納入 Layer 2。

---

## 3. 雙層架構約定

| 層級 | 說明 | 可否由前台編輯 |
|------|------|----------------|
| **Visible Prompt Layer** | Boss/投手/創意 已發布內容；設定頁可見、可發布/回滾 | 是（依 mode 發布） |
| **Hidden Calibration Layer** | 系統內建校準文案；不進同一編輯框 | 否（只讀） |

判讀 chat 與審判報告應依「當前模式」只載入該模式主 prompt 片段 + 該模式 calibration 片段，**不要**每次送兩份全文。

---

## 4. 審判 / 聊天路徑與組裝

| 路徑 | 說明 |
|------|------|
| `POST /api/review-sessions/message` | 使用 `getAssembledSystemPrompt` + `getPublishedPrompt(effectiveMode)`；`inferWorkflow(message.content)` 推斷 workflow。 |
| `POST /api/content-judgment/start` | 固定 workflow=audit；`getAssembledSystemPrompt` + `getPublishedPrompt(uiMode)`；傳入 `callGeminiContentJudgment` 的 overrides。 |

Content judgment 有 overrides 時用 Rich Bear 組裝；無 overrides 時 fallback 到既有 settings 路徑（見 `server/gemini.ts`）。

---

## 5. 不可變原則

- **Core 與 Calibration** 不被前台設定頁改掉；不被 overlay / draft / 已發布內容改寫。  
- **模式對應**：創意模式 → 素材審判；投手模式 → 廣告/ROI/漏斗決策；Boss 模式 → 決策摘要/商業判斷。  
- **Data Context** 來自決策憲法規定之 Single Source of Truth（batch、獲利規則、商品歸屬、todayAdjustCount 等）。  

---

## 6. 與其他憲法之關係

- **人格憲法**：Core 與 Calibration 的內容邊界（唯一靈魂、視角不是三個人格）。  
- **決策憲法**：Layer 5 Data Context 之資料來源與「不准亂判」邊界。  
- **產品憲法**：審判官頁為 Workflow 入口、介面靈魂不變。  
