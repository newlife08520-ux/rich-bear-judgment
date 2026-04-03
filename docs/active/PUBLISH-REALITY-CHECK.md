# Publish Reality Check（死路／真寫入對照）

**目的**：對照規格「無死路、happy path 可稽核」與 **本 repo 現狀**（不偽造 E2E 錄影）。

## 已非死路（程式錨點）

- 路由：`/publish` → `PublishCenterPage`（verify：`publish-ui-no-placeholder`）。
- Meta 最小路徑：`送往 Meta（預覽）` → dry-run → Gate → apply（見 `PUBLISH-MVP-CLOSURE.md`／`PUBLISH-MVP-CLOSURE-v2.md`）。
- 失敗：`mapMetaOrNetworkErrorToActionability`、Gate 錯誤、`MetaGlobalErrorBanner`（可行动 UX）。

## 仍屬 first-version／需真帳自證

- Stage1 寫入語意與 guard 依環境；**無 token 時不承諾成功**。
- 精靈內 `placeholder` 僅表單提示（非「頁級即將開放」）。

## Reviewer

- `npm run verify:commercial-readiness`；實機截圖／capture 須標 **Tier**（`TRUTH-PACK-TIER-MODEL-v3.md`）。
