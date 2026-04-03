# Publish MVP：限制與安全邊界

## 範圍

本文件描述投放中心（`/publish`）**已落地**能力與**刻意不承諾**事項，避免與 Meta 後台能力混淆。

## 已支援（MVP）

- 草稿建立／更新／複製；素材包＋版本選取；Wizard 與 Execution Gate。
- Meta 寫入為 **階段式**：以 execution handler 註冊表驅動；失敗時回傳可解析錯誤，供 `mapMetaOrNetworkErrorToActionability` 轉 UI。
- 同一使用者、同一日的 adjust 計數可由 out-of-band／workbench 路徑校準（見 `OUT-OF-BAND-SYNC-DESIGN.md`）。

## 限制

- Campaign／AdSet／Ad 三層未必一次到位；部分帳戶僅能建立 draft 或部分層級，依 Token 權限與帳戶狀態而定。
- 無法保證 Meta 端審核時程、拒登原因完整回傳；需以 execution 稽核與 Meta 後台交叉確認。
- 大量矩陣建稿仍受 API 限流與伺服器 timeout 影響；應分批與重試。

## 安全

- 不得靜默吞掉 Graph 401／403／429／5xx；錯誤須進 ledger／稽核敘事（見 `META-ERROR-HANDLING-RUNBOOK.md`）。
- 不在此頁面寫入 core persona／憲法 prompt；僅操作投放與 execution 契約資料。

## 驗證

- `npm run verify:commercial-readiness`（含 granular 子項）。
