# Stitch Context Pack（AI 行銷總監）

產生時間（UTC）：`2026-03-25T17:54:09.405Z`

## 用途

本壓縮包內 **14 個檔案** 專供 **Google Stitch**（或類似設計／原型工具）理解產品介面與資訊架構，**不可**當作含憑證或正式 API 契約的來源。

## 內容一覽

| 檔案 | 說明 |
|------|------|
| README.md | 本說明 |
| DESIGN.md | 設計語言與不可違反規則 |
| ROUTES.md | 前端路由對照 |
| TARGET-PAGES.md | 本包鎖定的目標頁 |
| judgment-home.md | 審判官首頁（/judgment）產品說明 |
| judgment-home-ui.txt | 審判官相關 UI 程式摘錄（已淨化） |
| support-workbench.md | 行動紀錄／支援工作台（/tasks） |
| support-workbench-ui.txt | 行動紀錄 UI 摘錄 |
| shared-ui.txt | 側欄與共用導航摘錄 |
| app-shell.txt | App 外殼版面摘錄 |
| *.png | 視窗首屏與第二摺截圖 |

## 安全聲明

- 已刻意 **不包含** `.env`、token、cookie、API key、資料庫連線字串。
- `*-ui.txt` 為自動過濾敏感關鍵字後的摘錄，若仍發現疑似敏感字串請勿外傳並回報。

## 重新產生

```bash
npm run stitch-context:pack
```

需本機安裝 **Google Chrome**（或可設 `CHROME_PATH`），用以擷取 PNG。
