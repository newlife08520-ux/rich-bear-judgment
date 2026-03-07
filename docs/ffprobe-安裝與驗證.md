# ffprobe 安裝與驗證（實跑紀錄）

## 1. 安裝方式（Windows，本輪實際執行）

- **方法**：使用 winget 安裝 FFmpeg（含 ffprobe），非互動模式。
- **指令**（已實跑成功）：
  ```powershell
  winget install -e --id BtbN.FFmpeg.GPL --accept-source-agreements --accept-package-agreements
  ```
- **實跑結果**：
  - 下載並安裝完成，套件：FFmpeg (GPL static variant, master branch) [BtbN.FFmpeg.GPL]。
  - 輸出包含：「已修改路徑環境變數；重新啟動命令介面以使用新值」「新增的命令列別名: "ffprobe"」「已成功安裝」。

## 2. 安裝後驗證 PATH 可用

- **注意**：安裝後當前終端可能尚未載入新 PATH，需**重新開啟終端**或**手動重載 PATH**。
- **手動重載 PATH（PowerShell）**：
  ```powershell
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  ```
- **驗證指令**：
  ```powershell
  ffprobe -version
  ```
- **實跑結果**：
  ```
  ffprobe version N-123073-g743df5ded9-20260228 Copyright (c) 2007-2026 the FFmpeg developers
  built with gcc 15.2.0 ...
  libavutil      60. 25.100 ...
  ```
  （exit code 0，表示 PATH 可用。）

## 3. 本機 health check 實跑

- **指令**（需先重載 PATH 或開新終端）：
  ```powershell
  node scripts/run-ffprobe-check.mjs
  ```
- **實跑結果**：
  - **HTTP status（若經 GET /api/health/ffprobe）**：**200**
  - **Response body**：`{ "ok": true, "message": "ffprobe 可執行" }`
  - **結論**：已從 503 ENOENT 變為 200 ok: true。

## 4. 其他環境

- **Linux（apt）**：`sudo apt update && sudo apt install -y ffmpeg`，安裝後執行 `ffprobe -version` 與 `node scripts/run-ffprobe-check.mjs` 驗證。
- **macOS（Homebrew）**：`brew install ffmpeg`，同上驗證。
- **若為對外服務**：啟動應用後對 `BASE_URL` 執行 `node scripts/verify-ffprobe.mjs <BASE_URL>` 取得 API 回傳結果。
