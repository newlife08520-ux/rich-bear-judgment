# Routes 與頁面拆分紀錄

依 cursor_acceptance_gap_closure Step 5。

## 已完成

### Routes 拆分
- **server/routes/auth-routes.ts**：登入、登出、me 已拆出，由 `registerAuthRoutes(app)` 掛載；主檔 `server/routes.ts` 於 session 後呼叫。
- 其餘 API 仍保留於 `server/routes.ts`；後續可依領域再拆（如 dashboard、content-judgment、refresh、workbench、settings）。

### 任務中心降級
- 已於 Step 2.2 完成：側欄改為「行動紀錄」、置於決策區次位。

### 巨型頁面（候選，尚未拆）
- **client/src/pages/dashboard.tsx**：行數多，可考慮拆成今日決策區塊、商品戰情區塊、黑馬素材區塊等子元件。
- **client/src/pages/products.tsx**：可考慮拆成篩選列、表格、決策卡區。
- **client/src/pages/judgment.tsx**：可考慮拆成對話區、證據區、決策卡區。
- 實際拆分可依需求與優先級另案執行。
