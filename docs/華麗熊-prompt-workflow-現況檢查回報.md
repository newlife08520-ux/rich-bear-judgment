# 華麗熊 Prompt / Workflow / 視角設定 — 現況檢查回報

（以實際程式為準，未改任何程式）

---

## 1. 實際檢查的檔案

| 檔案 | 用途 |
|------|------|
| `server/prompts/rich-bear-core.ts` | 人格真源 IMMUTABLE_CORE_PERSONA、getImmutableCorePersona() |
| `server/rich-bear-calibration.ts` | HIDDEN_CALIBRATION_FULL、getHiddenCalibration()；CALIBRATION_SLICE_* 與 getCalibrationSlice（舊相容） |
| `server/rich-bear-prompt-assembly.ts` | getAssembledSystemPrompt、組裝順序、AssembleOptions、UI_MODE_TO_INTERNAL、judgmentTypeToInternalModes、buildDataContextSection |
| `server/rich-bear-persona.ts` | getBaseCore() 委派給 getImmutableCorePersona()；MODE_A～E（InternalMode）與 getModePrompt() |
| `server/rich-bear-workflow-overlays.ts` | WORKFLOW_CLARIFY / CREATE / AUDIT / STRATEGY / TASK、getWorkflowOverlay() |
| `server/routes.ts` | POST /api/content-judgment/chat 呼叫 getPublishedPrompt(effectiveMode)、getAssembledSystemPrompt({ uiMode, customMainPrompt: publishedMain, workflow })；L480-485 單次 content-judgment 呼叫 getAssembledSystemPrompt 未帶 workflow |
| `server/workbench-db.ts` | getPublishedPrompt(mode)、getDraftPrompt(mode)、saveDraftPrompt、publishPrompt、rollbackPrompt（Prisma PromptVersion） |
| `client/src/pages/settings-prompts.tsx` | Boss/投手/創意三 Tab、Draft 編輯、已發布摘要、Hidden Calibration 只讀名稱 |
| `client/src/pages/judgment.tsx` | uiMode / workflow state、UI_MODE_TO_WORKFLOW、QUICK_PROMPTS 含 workflow、EMPTY_ENTRIES、handleQuickPrompt(text, workflowOverride?) |
| `server/routes.ts` L3104 | GET /api/workbench/calibration-modules 回傳 CALIBRATION_MODULE_NAMES 的 values |

---

## 2. Prompt 現況總圖

```
┌─────────────────────────────────────────────────────────────────────────┐
│  getAssembledSystemPrompt(options) 實際組裝順序                           │
├─────────────────────────────────────────────────────────────────────────┤
│  1. layer1Core           ← getBaseCore() = getImmutableCorePersona()    │
│     (唯一人格真源，server/prompts/rich-bear-core.ts)                       │
│  2. publishedOverlay     ← customMainPrompt（有值才加）                   │
│     (來自 getPublishedPrompt(uiMode)，即「已發布」主 prompt)               │
│  3. layer2Calibration   ← getHiddenCalibration() 整份                    │
│     (server/rich-bear-calibration.ts HIDDEN_CALIBRATION_FULL)            │
│  4. layer3Parts         ← [ getWorkflowOverlay(workflow) ]               │
│     + 若 workflow===audit：再疊 MODE_A/B/C/D（依 judgmentType 或 uiMode)  │
│     (Workflow 來自 rich-bear-workflow-overlays；MODE 來自 rich-bear-persona)│
│  5. layer4Data          ← dataContext 字串（有值才加）                    │
│     (buildDataContextSection 產出：商品、ROAS、Scale Readiness 等)        │
│  6. 僅 audit 時          ← STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION         │
│     (評分卡 JSON 格式)                                                    │
└─────────────────────────────────────────────────────────────────────────┘

資料流：
・Chat：routes 用 effectiveMode = uiMode ?? "creative"，effectiveWorkflow = body.workflow ?? inferWorkflow(content)
         → getPublishedPrompt(effectiveMode) → getAssembledSystemPrompt({ uiMode, customMainPrompt, workflow })
・單次 Content Judgment（L480-485）：getPublishedPrompt(uiMode)、judgmentType，未傳 workflow
         → workflow 預設 "clarify"，isAudit=false → 不會加 MODE 與 Output Schema
```

---

## 3. Boss / 投手 / 創意 的目前定位

| 維度 | 實際定位 |
|------|----------|
| **人格** | 否。人格只有一份，在 rich-bear-core.ts；Boss/投手/創意不是三種人格。 |
| **Overlay** | 間接。三者對應 **uiMode**（boss / buyer / creative）；僅在 **workflow=audit** 時，用 uiMode 選「內層 MODE 優先順序」：boss→[B,C,D]、buyer→[C,D]、creative→[A,B]，再疊 MODE_A～E 的文字（素材煉金術、轉單說服力、廣告投放判決、漏斗斷點、延伸靈感）。 |
| **uiMode** | 是。三者在 schema 與前端即 UIMode：boss / buyer / creative。用來：(1) 選「已發布」主 prompt（getPublishedPrompt(mode)）；(2) 當 workflow=audit 時選 MODE 組合。 |
| **workflow** | 否。workflow 是 clarify/create/audit/strategy/task 五個。但前端側欄「常用審判模式」點擊時會 **同時** setUiMode(m) 與 setWorkflow(UI_MODE_TO_WORKFLOW[m])：Boss→audit、投手→strategy、創意→create。 |
| **只是文字設定** | 部分。設定頁的「Draft / 已發布」是 **每個 mode 一份主 prompt 文字**，存於 DB（PromptVersion），已發布內容會當作 publishedOverlay 串進組裝。 |

結論：Boss/投手/創意 = **uiMode**（選已發布主 prompt + audit 時的 MODE 焦點），前端另用 **UI_MODE_TO_WORKFLOW** 綁定一個預設 workflow，不是獨立人格也不是 workflow 本身。

---

## 4. Prompt 設定頁目前實際作用

- **Draft**：存進 DB（PromptVersion status=draft），**不會**被組裝使用。只有按下「發布」後，該筆變成 status=published，才會被讀取。
- **已發布**：`getPublishedPrompt(mode)` 取該 mode 目前 published 的那一筆 content，傳入組裝的 **customMainPrompt**，在程式裡即 **publishedOverlay**，排在 **Layer 2 位置**（Core 之後、Calibration 之前）。
- **Hidden Calibration**：設定頁只顯示「已啟用模組名稱」（來自 `/api/workbench/calibration-modules` = CALIBRATION_MODULE_NAMES 的 values），**不可編輯**；實際組裝一律用 **getHiddenCalibration()** 整份，不依 mode 拆片。

因此：
- **會不會覆蓋人格真源？** 不會「取代」檔案裡的 Core，但已發布內容是整段字串接在 Core **後面**。若使用者在已發布裡寫「你是 OOO 總監」或一整套 system instruction，會形成 **第二段人格／指示**，與 Core 並存，沒有技術上的「不可覆蓋」保護。
- **會不會和 Hidden Calibration / workflow 打架？** 可能。若已發布寫「不要用情緒觸發」而 Calibration 有情緒觸發規則，或已發布寫「一律給評分」而 workflow 是 create/clarify，就會與 Layer 3 工作流規則重疊或矛盾。

---

## 5. 數據引擎與 Prompt 的邊界是否清楚

- **8:2、投手公式、Scale Readiness、預算建議**：  
  - **計算與邏輯**在 **scoring-engine.ts / analysis-engine.ts**（與 routes 內呼叫的計算）完成。  
  - **進 prompt 的方式**：以 **Data Context（Layer 4）** 傳入。例如 buildDataContextSection 會接 productName、breakEvenRoas、targetRoas、roas1d/3d/7d、scaleReadinessScore、suggestedAction、suggestedPct、reason、whyNotMore 等，組成一塊「本任務資料」字串，**不**寫進人格或 Calibration 內文。  
  - **Strategy workflow** 的 overlay 只提到「8:2 法則」是**適用情境**，沒有在 prompt 裡寫 8:2 或投手公式的計算方式。

結論：數據引擎產出 **結構化結果**，prompt 只收到 **已算好的 Data Context 文字**，邊界清楚；沒有把 8:2/投手公式/scale readiness 的「公式」混進人格或校準層。

---

## 6. 目前最明顯的 3 個打架點

1. **已發布主 prompt 與 Core / Calibration 的疊加**  
   已發布是任意長文字、直接接在 Core 後面。若使用者貼上整份「另一個人格」或與 Core、Calibration 矛盾的指示，會形成雙重人格或規則衝突，且沒有任何檢查或說明「此區僅適合補充、不適合重寫角色」。

2. **單次 Content Judgment（L480-485）未帶 workflow**  
   此路徑呼叫 getAssembledSystemPrompt 時只傳 uiMode、customMainPrompt、judgmentType，**沒有 workflow**。組裝內 workflow 預設為 "clarify"，isAudit 為 false，因此 **不會**加 MODE A/B/C/D 也不會加評分卡 Output Schema。若此 API 預期要做「單次審判」，行為會與 chat 的 audit 不一致（沒有評分卡、沒有審判用 MODE）。

3. **uiMode 同時驅動「已發布主 prompt」與「audit 時的 MODE 焦點」**  
   同一個 uiMode 既決定「讀哪一份已發布」（可能內容差異很大），又決定 audit 時疊哪一組 MODE（A/B/C/D/E）。若已發布內容與 MODE 描述不一致（例如已發布寫「只做創意」，MODE 卻是 B+C+D），或使用者誤解「換模式」只改視角、結果連主 prompt 都換掉，容易混淆或產生非預期組合。

---

## 7. 其他問項簡答（對應開頭 10 問）

- **1. 華麗熊人格真源**：放在 `server/prompts/rich-bear-core.ts`，常數 `IMMUTABLE_CORE_PERSONA` + `getImmutableCorePersona()`；**只有這一份**被組裝使用（經 rich-bear-persona 的 getBaseCore()）。
- **2. Hidden Calibration**：放在 `server/rich-bear-calibration.ts`（`HIDDEN_CALIBRATION_FULL`）；組進 prompt 的方式是 **getHiddenCalibration() 整份** 當作 layer2Calibration，插在 Core 與 publishedOverlay 之後、Workflow 之前。
- **3. 最終組裝順序**：見上方「Prompt 現況總圖」：Core → 已發布(optional) → Calibration → Workflow overlay（audit 時 + MODE）→ Data Context(optional) →（僅 audit）Output Schema。
- **4. Boss/投手/創意**：見上方「Boss/投手/創意的目前定位」。
- **5. Draft/已發布進到哪**：Draft 不進組裝；已發布進 **Layer 2 位置**（publishedOverlay）。
- **6. 設定頁能否覆蓋人格、是否打架**：不會改檔案裡的 Core，但已發布可實質「加一段第二人格」或與 Calibration/workflow 衝突，見打架點 1。
- **7. 8:2/投手公式/scale readiness/預算建議**：在數據引擎；prompt 只收 Data Context 字串，邊界清楚。
- **8. 仍有的假模式**：目前 **QUICK_PROMPTS** 與 **側欄常用審判模式** 已改為會 setWorkflow；**EMPTY_ENTRIES** 會 setWorkflow + setUiMode + prefill。未再發現「只塞固定句、不帶 workflow」的按鈕。
- **9. 人格分裂/規則重疊/多方打架**：見上方「目前最明顯的 3 個打架點」。
- **10. 僅回報現況與風險**：以上皆為現況與風險，未提方案。
