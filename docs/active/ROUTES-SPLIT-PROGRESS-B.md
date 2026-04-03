# ROUTES-SPLIT-PROGRESS B（Batch 16.5 契約）

**前置**：`docs/active/ROUTES-SPLIT-PROGRESS-A.md`、`ROUTES-SPLIT-PROGRESS-v16.md`。

## B 階目標（strangler only）

- 自 `server/routes.ts` 再拆：**dashboard 同質 API**、**execution 註冊**（若仍殘留）、其餘大型區塊 **逐模組** 遷出。
- **禁止**：單次巨型 rewrite；須維持 `register*` 組裝與既有 import。

## 驗收

- `npm run check`、`verify:commercial-readiness:routes-split-meta-ops`（現況）+ 未來可選 `routes-split-safe` granular。
