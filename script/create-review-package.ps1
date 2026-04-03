# Legacy：目錄複製式 review 包（非官方審查 ZIP）
# 官方交付請用：npm run verify:release-candidate && npm run create-review-zip:verified
# 見 script/README-review-package.md
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path (Split-Path -Parent $root) "Du-She-Shen-Pan-Guan-review"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest -Force | Out-Null

function Copy-DirExclude($src, $dst, $exclude) {
    if (-not (Test-Path $src)) { return }
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    Get-ChildItem -Path $src -Force | Where-Object { $_.Name -notin $exclude } | ForEach-Object {
        $t = Join-Path $dst $_.Name
        if ($_.PSIsContainer) {
            if ($_.Name -eq "uploads" -and (Split-Path -Leaf (Split-Path -Parent $src)) -eq "data") { return }
            Copy-DirExclude $_.FullName $t $exclude
        } else {
            Copy-Item $_.FullName $t -Force
        }
    }
}

$exclude = @("node_modules", ".git", ".env", "uploads")
@("server", "shared", "script", "docs", "sample-data", "prisma") | ForEach-Object {
    $s = Join-Path $root $_
    if (Test-Path $s) { Copy-DirExclude $s (Join-Path $dest $_) $exclude }
}
$clientSrc = Join-Path $root "client"
$clientDst = Join-Path $dest "client"
if (Test-Path $clientSrc) {
    New-Item -ItemType Directory -Path $clientDst -Force | Out-Null
    Get-ChildItem -Path $clientSrc -Force | Where-Object { $_.Name -ne "node_modules" } | ForEach-Object {
        $t = Join-Path $clientDst $_.Name
        if ($_.PSIsContainer) { Copy-DirExclude $_.FullName $t $exclude }
        else { Copy-Item $_.FullName $t -Force }
    }
}
@("package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "tailwind.config.ts", "postcss.config.js", "components.json", "prisma.config.ts") | ForEach-Object {
    $s = Join-Path $root $_
    if (Test-Path $s) { Copy-Item $s (Join-Path $dest $_) -Force }
}
Write-Host "Legacy review folder: $dest"
Write-Host "Canonical ZIP path: npm run verify:release-candidate && npm run create-review-zip:verified"
$dest
