# docs/active（精簡版）

營運／審查用**機讀清單與快照**預設仍寫入本目錄（例如 `npm run generate:stage0-audit` 產出 `API-ENDPOINT-INVENTORY.json` 等）。

若執行過 `script/agent-archive-migrate.ps1`，歷史 **BATCH 完成報告與 Agent 產出**會改存於本機 **`_agent_batch_archives/docs/`**（已 `.gitignore`，不進遠端）。審查 ZIP 仍會自該封存目錄併入 `docs/...` 路徑。
