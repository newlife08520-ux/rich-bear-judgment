# Publish MVP 真閉環（Commercial）

## 目標

`/publish` 提供可操作的投放草稿工作台，並經 **dry-run → apply gate** 打通至 `meta_publish_draft_execute`（Stage1 PAUSED 實體），非僅說明頁。

## 已落地

- 列表＋精靈：`PublishPageView`、`usePublishWorkbench`、`PublishWizardDialog`。
- Meta 路徑：`送往 Meta（預覽）` → `executionDryRun("meta_publish_draft_execute")` → `PublishExecutionGateDialog`（`gateMode="meta"`）→ `executionApply`。
- 後端：`server/modules/execution/handlers/meta-publish-draft-execute-handler.ts`；環境旗標見 `meta-execution-guard`／`meta-publish-guard`。
- 草稿持久化：`PublishDraftRecord`（Prisma）。

## 限制（第一版）

- 完整 Campaign／AdSet／Ad 三層產品化 UI 仍非終局；Stage1 為 **foundation + 真寫入最小路徑**。
- 失敗時以稽核與 Graph 錯誤為準；需有效 token 與寫入允許。

## Reviewer

- 驗證：`npm run verify:commercial-readiness`（內含 Publish 契約 grep）。
- 程式錨點：`client/src/pages/publish/`、`server/modules/publish/`、`server/modules/meta-publish/`。
