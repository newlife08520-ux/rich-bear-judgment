# UI 閉環驗證 — 最終證據回報

依 **docs/UI閉環驗證-runbook.md** 完成端到端證據留存。本文件為證據整理。

---

## 1. 上傳後 API 回應（關鍵資料）

- **端點**：`POST /api/asset-packages/:id/versions/upload`
- **影片**：`scripts/sample-video.mp4`
- **結果**：HTTP 200，回應含 `detection`。

```json
{
  "status": 200,
  "ok": true,
  "fileUrl": "/api/uploads/1/7061fe80_sample-video.mp4",
  "fileName": "sample-video.mp4",
  "fileType": "video/mp4",
  "detection": {
    "detectedWidth": 320,
    "detectedHeight": 176,
    "detectedAspectRatio": "16:9",
    "detectedDurationSeconds": 10,
    "detectStatus": "success",
    "detectSource": "metadata"
  }
}
```

取得方式：以 **scripts/run-ui-closure-evidence.mjs** 登入後對該影片執行上傳，擷取回應。  
（前置：`npm run dev` 已啟動、port 5000 為當前 dev server；若 port 被舊 process 佔用，上傳回應會缺 `detection`，需結束舊 process 後重啟 dev 再跑腳本。）

---

## 2. 建立版本成功之資料證據

- **端點**：`POST /api/asset-packages/:id/versions`
- **body**：含 `assetType`、`aspectRatio`、`fileName`、`fileUrl`、`fileType`、`detectedWidth`、`detectedHeight`、`detectedAspectRatio`、`detectedDurationSeconds`、`detectStatus`、`detectSource`（來自上傳之 `detection`）。
- **結果**：HTTP 201，回傳建立之版本。

```json
{
  "status": 201,
  "ok": true,
  "versionId": "8c213918-3e9e-49a7-822c-6f92fed6670d",
  "detectStatus": "success",
  "detectSource": "metadata",
  "aspectRatio": "16:9",
  "detectedWidth": 320,
  "detectedHeight": 176,
  "detectedDurationSeconds": 10
}
```

---

## 3. GET versions 該筆版本（寫入後讀出）

- **端點**：`GET /api/asset-packages/:id/versions`
- **結果**：列表中含上述 versionId，欄位完整。

```json
{
  "targetVersion": {
    "id": "8c213918-3e9e-49a7-822c-6f92fed6670d",
    "detectStatus": "success",
    "detectSource": "metadata",
    "aspectRatio": "16:9",
    "detectedWidth": 320,
    "detectedHeight": 176,
    "detectedDurationSeconds": 10
  }
}
```

---

## 4. 六個欄位最終值

| 欄位 | 值 |
|------|-----|
| detectStatus | `success` |
| detectSource | `metadata` |
| aspectRatio | `16:9` |
| detectedWidth | `320` |
| detectedHeight | `176` |
| detectedDurationSeconds | `10` |

---

## 5. 素材中心截圖

- **預期**：該版本卡顯示 Badge「真偵測」。
- **本輪**：以 **cursor-ide-browser** MCP 對 `http://127.0.0.1:5000/assets/` 擷取全頁／視窗截圖時發生逾時，**未取得截圖檔案**。
- **補齊方式**：請人工依 runbook 開啟素材中心 → 選該素材包 → 找到對應版本卡（檔名 sample-video.mp4、比例 16:9）→ 截圖 Badge「真偵測」後貼至本節或集中證據處。

---

## 6. 投放中心截圖

- **預期**：投放中心選同一素材包、同一版本時，該版本顯示「真偵測」。
- **本輪**：同上，MCP 截圖逾時，**未取得截圖檔案**。
- **補齊方式**：請人工依 runbook 進入投放中心 → 選同一素材包 → 在「選素材版本」區找到該版本 → 截圖「真偵測」狀態後貼至本節或集中證據處。

---

## 7. 證據摘要

| 項目 | 狀態 | 備註 |
|------|------|------|
| 上傳 API 含 detection | ✅ 已取得 | 見 §1 |
| 建立版本成功 | ✅ 已取得 | 見 §2 |
| GET versions 含完整 detect* | ✅ 已取得 | 見 §3 |
| 六欄位最終值 | ✅ 已取得 | 見 §4 |
| 素材中心「真偵測」截圖 | ⏳ 待補 | 需人工截圖 |
| 投放中心「真偵測」截圖 | ⏳ 待補 | 需人工截圖 |

**結論**：API 與資料流證據已齊；UI 兩處截圖需人工依 runbook 補齊後，即可作為完整端到端閉環證據。
