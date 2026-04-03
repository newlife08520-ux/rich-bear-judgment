# 09 — OPEN ISSUES, RISKS, AND LIKELY BUGS

> 本檔對齊 `docs/OPEN-ISSUES-AND-BLOCKERS.md` 與 `docs/active/GEMINI-REVIEW-STAGE0-AUDIT.md`，**不美化**。

## 功能缺口（仍没收好）

1. **Publish 產品化**：路由多為 placeholder；與 execution 底層能力不匹配。  
2. **全站「執行歷史」敘事**：後端有痕跡，使用者不一定能在每個相關頁讀到一致故事。  
3. **CI 版本歸因完整度**：長尾、延遲、跨 entity 對齊仍弱。  
4. **Tier C／D 真實擷取**：多為契約／placeholder，審查包無法宣稱 prod-sanitized 已滿。

## 資料不一致風險

- **`dataStatus` vs `homepageDataTruth`**：不同語意；若某頁只顯示其一，使用者可能誤判「有沒有資料」。  
- **partial vs no data**：文案或翻譯漂移會造成假陽性／假陰性。  
- **Precompute 與即時 API**：快取過期或 job 失敗時，儀表板子區塊可能不同步。  
- **同一 creative／product 在不同頁的 ID 映射**：長期維護風險。

## Phase／canonicality／docs 漂移

- `REVIEW-PACK-MANIFEST.json` 的 `completionReports` 若列到已刪檔，ZIP 實際內容與清單心理模型不一致。  
- 舊 BATCH 完成報告在 `docs/archive`；敘事若引用錯批次號易混淆。  
- **已緩解**：`generatorVersion` 與 `phase-batch15_9-complete` 對齊；仍需每輪封包驗證。

## UX 仍可能混亂之處

- **多表面、多摺疊**：首頁 command v12 已收斂，但新使用者仍可能不知「下一步去哪頁」。  
- **FB 多 tab**：預算／素材／警示並存，與首頁指令的對應關係需記憶。  
- **Judgment Operator 深度**：資訊量大，易與 Focus 混淆若未讀說明。  
- **GA4 與廣告敘事**：兩套時間維度與歸因，並列時若無提示易爭議。

## 專題風險線

| 主題 | 風險 |
|------|------|
| **0 spend** | 若某分支繞過 `visibility-policy` 單獨過濾，可能與「不可全隱藏」哲學衝突 |
| **Dormant** | revival 分數與桶邊界在極端帳戶是否穩定 |
| **Partial data** | 摘要晚到時，使用者是否以為「系統壞了」而非「partial」 |
| **Truth pack** | Tier 標籤未讀時高估可信度 |

## 技術債（巨型檔／schema）

- `server/routes.ts`（約 2300+ 行）、`shared/schema.ts`（約 1700+ 行）：改動連鎖、review 成本、merge 衝突。  
- 已開始拆分：`dashboard-truth-routes.ts`、`recommendation-level.ts` 等；**主體仍集中**。

## 最值得優先修的 10 件事（建議排序）

1. 持續拆分 `routes.ts`／`schema.ts`（batch102 方向）。  
2. Publish 最小可用路徑 + 明確「未就緒」標示。  
3. 全站掃描 `partial`／`no data`／`summary` 文案一致性。  
4. Execution 錯誤碼 → 使用者可行动文案。  
5. CI 歸因限制在 UI 常駐披露（與 tier 模型一致）。  
6. 統一「從首頁指令到 FB／Products／CI」的深連結測試清單。  
7. Precompute 失敗時的降级展示策略（避免靜默錯誤）。  
8. Meta token 過期／權限不足的全站處理一致性。  
9. manifest／completionReports 與磁碟定期同步腳本或 CI 檢查。  
10. 真實帳戶抽樣驗證（非僅 verify 腳本）一季一輪。

## 下一步

使用 `docs/gemini-review-pack/10-GEMINI-REVIEW-CHECKLIST-AND-QUESTIONS.md` 做外部審問；修復以 **verify:release-candidate** 全綠為回歸門檻。
