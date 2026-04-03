# Actionable Error UX Matrix v2

**Canonical v1**：`docs/active/ACTIONABLE-ERROR-UX-MATRIX.md`。

## v2 補強（規格：error surface escalation）

| 類型 | primaryAction | UI 層級（最低要求） |
|------|----------------|---------------------|
| 401／過期 token | reauth | 頁內／toast + **可選全域 banner** |
| 403／權限 | check_permissions | 同上 |
| 429 | retry_later | 同上 + 節流說明 |
| 暫態網路 | retry_later | 同上 |

- **Audit**：對應操作應留下 execution／publish 日誌（失敗列可查）。
- **Verify**：`verify:commercial-readiness:meta-error-ux` + `token-expiry-surface` + `rate-limit-degradation`。
