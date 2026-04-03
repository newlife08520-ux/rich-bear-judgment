# 產出「單一」可驗收 Review 包 ZIP（一包含全部，不拆兩包）
# 必須含：package.json, package-lock.json, tsconfig.json, vite.config.*, tailwind.config.*,
#         server/, shared/, client/src/, script/, docs/, sample-data/, prisma/
# 一律不含：node_modules/, .git/, .env, .data/uploads/, 大素材, 暫存檔, IDE 設定
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$zipPath = Join-Path $root "Du-She-Shen-Pan-Guan-Review.zip"
$tempDir = Join-Path $env:TEMP "Du-She-Shen-Pan-Guan-ReviewPack"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$exclude = @("node_modules", ".git", ".env", "uploads", "dist", ".agents", ".config", ".local", ".replit", ".cursor", ".vscode")

function Copy-DirExclude($src, $dst, $excludeList) {
    if (-not (Test-Path $src)) { return }
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    Get-ChildItem -Path $src -Force | Where-Object { $_.Name -notin $excludeList } | ForEach-Object {
        $t = Join-Path $dst $_.Name
        if ($_.PSIsContainer) {
            if ($_.Name -eq "uploads" -and (Split-Path -Leaf (Split-Path -Parent $src)) -eq "data") { return }
            Copy-DirExclude $_.FullName $t $excludeList
        } else {
            Copy-Item $_.FullName $t -Force
        }
    }
}

# 必含目錄
@("server", "shared", "script", "docs", "sample-data", "prisma") | ForEach-Object {
    $s = Join-Path $root $_
    if (Test-Path $s) { Copy-DirExclude $s (Join-Path $tempDir $_) $exclude }
}

# client：整份複製但排除 node_modules（含 client/src/）
$clientSrc = Join-Path $root "client"
$clientDst = Join-Path $tempDir "client"
if (Test-Path $clientSrc) {
    New-Item -ItemType Directory -Path $clientDst -Force | Out-Null
    Get-ChildItem -Path $clientSrc -Force | Where-Object { $_.Name -ne "node_modules" } | ForEach-Object {
        $t = Join-Path $clientDst $_.Name
        if ($_.PSIsContainer) { Copy-DirExclude $_.FullName $t $exclude }
        else { Copy-Item $_.FullName $t -Force }
    }
}

# 根目錄必含檔案
@("package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "tailwind.config.ts", "postcss.config.js", "components.json", "prisma.config.ts", ".gitignore") | ForEach-Object {
    $s = Join-Path $root $_
    if (Test-Path $s) { Copy-Item $s (Join-Path $tempDir $_) -Force }
}

# 產出單一 ZIP（覆蓋舊檔）
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath -Force
Remove-Item $tempDir -Recurse -Force
Write-Output $zipPath
