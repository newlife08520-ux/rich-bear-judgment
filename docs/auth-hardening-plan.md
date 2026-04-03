# Auth 強化計畫

依 cursor_acceptance_gap_closure Step 7。

## Stage 1（Batch 3.1）— 已完成

| 項目 | 實作 |
|------|------|
| **密碼** | bcrypt `passwordHash`；legacy 明文最後一次登入後升級為 hash（`server/auth/passwords.ts`） |
| **Session** | SQLite 持久化（`.data/sessions.sqlite`，`server/session/sqlite-session-store.ts`） |
| **Cookie** | production：`secure: true`、`httpOnly`、`sameSite: lax` |
| **SESSION_SECRET** | production 未設或 &lt;32 字元則啟動失敗 |
| **Rate limit** | 登入 API 限流、429（`server/auth/login-rate-limit.ts`） |

## 仍待後續（非 Stage 1）

1. **CSRF**：若表單登入，加上 CSRF token。
2. **稽核**：登入成功／失敗寫入 audit log（workbench-audit 或獨立）。
3. **橫向擴展**：多機部署可改 Redis session。

詳見 **`docs/BATCH3.1-COMPLETION-REPORT.md`**。
