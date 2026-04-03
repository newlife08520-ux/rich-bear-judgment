# STAGING-CAPTURE-CONTRACT

- **取得方式**：由核准之 staging 環境匯出，經欄位 allowlist 脫敏。  
- **檔名**：建議 `*-staging-sanitized.*` 或置於 `docs/STAGING-RUNTIME-CAPTURES/`。  
- **未就緒時**：保留 placeholder JSON 並在 `_meta.truthTier` 標 `Tier C` + `captureStatus: pending`。
