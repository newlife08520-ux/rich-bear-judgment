# 02 — CONSTITUTION, PERSONA, AND PROMPT LOGIC

> **本檔僅摘要架構與順序，不重寫 Core Persona／Hidden Calibration 正文**（避免漂移）。實際字句以 `server/prompts/rich-bear-core.ts`、`server/rich-bear-calibration.ts` 為唯一真源。

## 產品精神與原始目標（摘要）

- 協助 **AI 行銷總監式** 的決策：在 **真實投放與網站資料** 上，先做 **規則與引擎可辯護的結論**，再以 AI 協助 **澄清、創意、審判、策略、任務** 等工作流。  
- **Rich Bear／審判官**：對外人格與語氣來自 Core；**數值與桶別**來自引擎與 schema，**不可**由聊天隨意改寫。

## 「四層憲法」與實作六層組裝（對照）

**產品上常說的四層**可理解為：

1. **人格與語氣真源**（Core Persona）  
2. **不可被設定頁覆寫的校準**（Hidden Calibration）  
3. **工作流與模式**（Workflow + audit MODE）  
4. **資料與規則邊界**（Data context 僅帶「引擎結果」，不帶「公式本體」到 prompt 任意改寫）

**程式上** `getAssembledSystemPrompt`（`server/rich-bear-prompt-assembly.ts`）的**固定順序**為：

1. **Core Persona** — `getBaseCore()`  
2. **已發布視角 Overlay** — 設定頁「已發布」內容；**僅加法補充**，不可覆蓋 Core、**不可重寫** Hidden Calibration  
3. **Hidden Calibration** — `getHiddenCalibration()`，**只讀**  
4. **Workflow Overlay** — `clarify | create | audit | strategy | task`；`audit` 時可疊加 **MODE A/B/C/D**  
5. **Data Context** — 本次任務資料（有字數上限）  
6. **Output Schema** — **僅 audit** 等情境附加結構化評分卡

## Rich Bear／審判官／AI 行銷總監

- **Rich Bear**：對使用者說話的人格與方法論（Core + 允許的 Overlay）。  
- **審判官**：偏 **audit 工作流 + 結構化輸出 + 與系統動作對齊**（`validateJudgmentAgainstSystemAction` 等）。  
- **AI 行銷總監**：**產品角色定位**，不是單一 API 名稱；實現上 = 上述組裝 + 資料上下文。

## Boss／Buyer／Creative 三視角

- `UIMode = boss | buyer | creative`：影響 **published overlay 選取**與 **audit 時 MODE 組合**（見 `UI_MODE_TO_INTERNAL`）。  
- **不等於**三套數學公式；公式在 **shared engines**，視角影響「怎麼說、先看什麼」。

## 工作流 clarify / create / audit / strategy / task

| Workflow | 角色（摘要） |
|----------|----------------|
| clarify | 澄清目標與限制 |
| create | 產出草稿／創意方向 |
| audit | 結構化審判 + MODE 骨架 |
| strategy | 策略層推演 |
| task | 可執行任務拆解 |

## Persona vs engine vs data 責任切分

| 類型 | 誰負責 |
|------|--------|
| 語氣、教學式表達、總監式框架 | Persona + workflow overlay |
| ROAS 桶、partial、0 spend、dormant 分桶、Pareto 排序邏輯 | **Engine + schema + server 建 payload** |
| 「建議動作字串」與卡片 | Engine 產結構；UI 呈現；AI 在 audit 內對齊 |

## **不可亂改的語義邊界**（審查注意）

- **Core Persona**、**Hidden Calibration**、**憲法式順序**：外部審查可提「是否太長／是否與產品不一致」，但**不應**在未讀真源檔案下建議「合併成一層」或「讓設定頁覆寫校準」。  
- **本專案要求**：維持「公式只算一次、人格只定一次、校準只定一次」的**分層原則**。

## 為何不是普通聊天工具

一般 Chat UI：**無**與 action-center、execution gate、structured judgment schema 的**硬連結**。本系統在 production path 上要求 **parse → align → 對外輸出**，是 **總監型 decision layer**，不是自由對話優先。
