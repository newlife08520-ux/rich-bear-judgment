# Execution Audit Surface v2

**Canonical v1**：`docs/active/EXECUTION-AUDIT-SURFACE.md`。

## v2 對照規格（已落地之欄位／連結）

- **誰／何時／改了什麼／失敗／rollback note**：`/execution-history` 表格含 `userId`、`timestamp`、`actionType`、`status`、`affectedIds`／`resultMeta`、`errorMessage`、`rollbackNote`（見 `execution-history.tsx` + `execution-log-display.ts`）。
- **Cross-surface 連結**（至 `/execution-history`）：
  - 首頁（儀表）：`link-dashboard-to-execution-audit`
  - 商品：`link-products-to-execution-audit`
  - 發佈：`link-publish-to-execution-audit`
  - 投放：`link-fbads-to-execution-audit`

## Proof pack（須真環境）

- 截圖／DB snapshot／runtime capture 對照矩陣由 reviewer 依 Tier 標註執行；**本 repo 不內嵌偽造 prod 圖**。
