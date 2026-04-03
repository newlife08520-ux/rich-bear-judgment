# 將 Agent 批次驗證／報告移入 _agent_batch_archives（目錄已 .gitignore）。
# 執行：專案根目錄 powershell -File script/agent-archive-migrate.ps1
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$arch = Join-Path $root "_agent_batch_archives"
$archScript = Join-Path $arch "script"
$archDocs = Join-Path $arch "docs"
New-Item -ItemType Directory -Path $archScript -Force | Out-Null
New-Item -ItemType Directory -Path $archDocs -Force | Out-Null

function Ensure-Dir($p) {
  $d = Split-Path -Parent $p
  if ($d -and -not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

# --- script: verify-batch*.ts ---
Get-ChildItem -LiteralPath (Join-Path $root "script") -Filter "verify-batch*.ts" -File | ForEach-Object {
  Move-Item -LiteralPath $_.FullName -Destination (Join-Path $archScript $_.Name) -Force
}

foreach ($aux in @("pack-review-zip-allowlist.ps1")) {
  $p = Join-Path (Join-Path $root "script") $aux
  if (Test-Path -LiteralPath $p) { Move-Item -LiteralPath $p -Destination (Join-Path $archScript $aux) -Force }
}

$rr = Join-Path $root "script\lib\read-review-pack-generator-version.ts"
if (Test-Path -LiteralPath $rr) {
  $ad = Join-Path $archScript "lib"
  New-Item -ItemType Directory -Path $ad -Force | Out-Null
  Move-Item -LiteralPath $rr -Destination (Join-Path $ad "read-review-pack-generator-version.ts") -Force
}

$docsRoot = Join-Path $root "docs"
if (-not (Test-Path $docsRoot)) { Write-Output "[agent-archive-migrate] no docs/"; exit 0 }

# --- 整個 docs/active（必須先搬：若先逐檔搬 BATCH 再對 dest 做 Remove-Item 會誤刪已封存檔案）---
$active = Join-Path $docsRoot "active"
$destActive = Join-Path $archDocs "active"
if (Test-Path -LiteralPath $active) {
  New-Item -ItemType Directory -Path (Split-Path -Parent $destActive) -Force | Out-Null
  if (-not (Test-Path -LiteralPath $destActive)) {
    Move-Item -LiteralPath $active -Destination $destActive -Force
  } else {
    robocopy $active $destActive /E /MOV /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    if (Test-Path -LiteralPath $active) { Remove-Item -LiteralPath $active -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

# --- BATCH completion / summary / index（其餘路徑；不含已搬離之 active）---
Get-ChildItem -Path $docsRoot -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
  $_.FullName -notmatch '[\\/]_agent_batch_archives[\\/]' -and
  $_.Name -match '^BATCH.*-COMPLETION-(REPORT|SUMMARY|INDEX)\.md$'
} | ForEach-Object {
  $rel = $_.FullName.Substring($docsRoot.Length).TrimStart('\', '/')
  $dest = Join-Path $archDocs $rel
  Ensure-Dir $dest
  Move-Item -LiteralPath $_.FullName -Destination $dest -Force
}

# --- VERIFY-FULL-OUTPUTS ---
$vfo = Join-Path $docsRoot "VERIFY-FULL-OUTPUTS"
$destVfo = Join-Path $archDocs "VERIFY-FULL-OUTPUTS"
if (Test-Path -LiteralPath $vfo) {
  if (Test-Path -LiteralPath $destVfo) { Remove-Item -LiteralPath $destVfo -Recurse -Force }
  Move-Item -LiteralPath $vfo -Destination $destVfo -Force
}

# --- docs 根目錄：全大寫片段之 .md（略過 README）---
Get-ChildItem -LiteralPath $docsRoot -Filter "*.md" -File -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -ne "README.md" -and $_.Name -cmatch '^[A-Z0-9]+([._-][A-Z0-9]+)+\.md$'
} | ForEach-Object {
  Move-Item -LiteralPath $_.FullName -Destination (Join-Path $archDocs $_.Name) -Force
}

# --- docs 子目錄（非 capture）：COMMAND / DORMANT / DOCS- / HOMEPAGE- 等單層子資料夾內之 md ---
$skipTop = @(
  "LIVE-RUNTIME-CAPTURES", "RUNTIME-QUERY-CAPTURES", "SANITIZED-DB-SNAPSHOTS",
  "PAGE-STATE-SCREENSHOTS", "STAGING-RUNTIME-CAPTURES", "PROD-RUNTIME-CAPTURES",
  "VERIFY-FULL-OUTPUTS", "active", "constitution"
)
Get-ChildItem -LiteralPath $docsRoot -Directory -ErrorAction SilentlyContinue | Where-Object {
  $skipTop -notcontains $_.Name
} | ForEach-Object {
  Get-ChildItem -LiteralPath $_.FullName -Recurse -File -Filter "*.md" -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -ne "README.md" -and $_.Name -cmatch '^[A-Z]'
  } | ForEach-Object {
    $rel = $_.FullName.Substring($docsRoot.Length).TrimStart('\', '/')
    $dest = Join-Path $archDocs $rel
    Ensure-Dir $dest
    Move-Item -LiteralPath $_.FullName -Destination $dest -Force
  }
}

@"
# Agent batch archives（本機封存，不進 Git）

- 內容由 script/agent-archive-migrate.ps1 自 docs/、script/ 移入。
- 審查包：node script/create-review-zip.mjs 會從本目錄 docs/ 併入 BATCH completion（路徑仍為 docs/...）。
"@ | Set-Content -Path (Join-Path $arch "README.txt") -Encoding UTF8

Write-Output "[agent-archive-migrate] done -> $arch"
