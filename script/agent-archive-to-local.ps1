# 營運長：將 Agent 批次產物移至 _agent_batch_archives（本機封存，由 .gitignore 排除上傳）
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$arch = Join-Path $root "_agent_batch_archives"
New-Item -ItemType Directory -Force -Path (Join-Path $arch "script") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $arch "script\lib") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $arch "docs") | Out-Null

function Move-IntoArchive($relativePath) {
  $src = Join-Path $root $relativePath
  if (-not (Test-Path $src)) { return }
  $dst = Join-Path $arch $relativePath
  $parent = Split-Path $dst -Parent
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  Move-Item -LiteralPath $src -Destination $dst -Force
}

# verify-batch*.ts
Get-ChildItem -Path (Join-Path $root "script") -Filter "verify-batch*.ts" -File -ErrorAction SilentlyContinue | ForEach-Object {
  Move-Item -LiteralPath $_.FullName -Destination (Join-Path $arch "script" $_.Name) -Force
}

# 輔助腳本（營運長列名）
foreach ($f in @("pack-review-zip-allowlist.ps1")) {
  $p = Join-Path $root "script" $f
  if (Test-Path $p) { Move-Item -LiteralPath $p -Destination (Join-Path $arch "script" $f) -Force }
}
$p = Join-Path $root "script\lib\read-review-pack-generator-version.ts"
if (Test-Path $p) { Move-Item -LiteralPath $p -Destination (Join-Path $arch "script\lib\read-review-pack-generator-version.ts") -Force }

# docs/active 整包
Move-IntoArchive "docs\active"

# 驗證輸出目錄
Move-IntoArchive "docs\VERIFY-FULL-OUTPUTS"

# 其餘 docs 內 BATCH 完成報告／摘要／索引（尚未在 active 內者）
Get-ChildItem -Path (Join-Path $root "docs") -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -match '^BATCH.*-COMPLETION-(REPORT|SUMMARY|INDEX)\.md$'
} | ForEach-Object {
  $docsRoot = Join-Path $root "docs"
  $rel = $_.FullName.Substring($docsRoot.Length).TrimStart('\', '/')
  $dst = Join-Path (Join-Path $arch "docs") $rel
  $par = Split-Path $dst -Parent
  if (-not (Test-Path $par)) { New-Item -ItemType Directory -Force -Path $par | Out-Null }
  Move-Item -LiteralPath $_.FullName -Destination $dst -Force
}

# docs 根目錄：大寫/縮寫風格之 .md 報告（排除 README）
Get-ChildItem -Path (Join-Path $root "docs") -Filter "*.md" -File -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.Name -eq "README.md") { return }
  if ($_.Name -cmatch '^[A-Z][A-Z0-9_.-]+\.md$') {
    Move-Item -LiteralPath $_.FullName -Destination (Join-Path $arch "docs" $_.Name) -Force
  }
}

# docs 子目錄內同風格 .md（略過已為資料目錄者）
$skipRel = @("LIVE-RUNTIME-CAPTURES", "RUNTIME-QUERY-CAPTURES", "SANITIZED-DB-SNAPSHOTS", "PAGE-STATE-SCREENSHOTS", "STAGING-RUNTIME-CAPTURES", "PROD-RUNTIME-CAPTURES", "active", "VERIFY-FULL-OUTPUTS")
Get-ChildItem -Path (Join-Path $root "docs") -Recurse -File -Filter "*.md" -ErrorAction SilentlyContinue | ForEach-Object {
  $rel = $_.FullName.Substring((Join-Path $root "docs").Length).TrimStart('\', '/')
  $top = ($rel -split '[\\/]')[0]
  if ($skipRel -contains $top) { return }
  if ($_.Name -match '^BATCH.*-COMPLETION-') { return }
  if ($_.Name -cmatch '^[A-Z][A-Z0-9_.-]+\.md$') {
    $dst = Join-Path (Join-Path $arch "docs") $rel
    $par = Split-Path $dst -Parent
    if (-not (Test-Path $par)) { New-Item -ItemType Directory -Force -Path $par | Out-Null }
    Move-Item -LiteralPath $_.FullName -Destination $dst -Force
  }
}

Write-Output "OK: archive at $arch"
