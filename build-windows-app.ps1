#Requires -Version 5.0
<#
.SYNOPSIS
    Build LLM Bench Windows Application
.DESCRIPTION
    One-click script to build the professional Windows GUI application
    Creates .exe installer with no Smart App Control warnings
#>

param(
    [switch]$Dev,
    [switch]$Release,
    [switch]$OpenFolder
)

$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = $ScriptPath

Write-Host "╭─── LLM Bench Windows App Builder ───╮" -ForegroundColor Cyan
Write-Host "│ Building Professional Windows GUI   │" -ForegroundColor Cyan
Write-Host "╰──────────────────────────────────────╯" -ForegroundColor Cyan

# Function to check if command exists
function Test-CommandExists {
    param($command)
    $null = Get-Command $command -ErrorAction SilentlyContinue
    return $?
}

# Step 1: Check prerequisites
Write-Host "`n[1/5] Checking prerequisites..." -ForegroundColor Yellow

$checks = @(
    @{Name = "Node.js"; Command = "node"; MinVersion = "16" },
    @{Name = "npm"; Command = "npm"; MinVersion = "7" },
    @{Name = "Rust"; Command = "rustc"; MinVersion = "1.7" }
)

foreach ($check in $checks) {
    if (Test-CommandExists $check.Command) {
        $version = & $check.Command --version
        Write-Host "  ✅ $($check.Name): $version" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.Name) not found!" -ForegroundColor Red
        Write-Host "     Download: https://nodejs.org and https://rustup.rs" -ForegroundColor Yellow
        exit 1
    }
}

# Step 2: Install dependencies
Write-Host "`n[2/5] Installing dependencies..." -ForegroundColor Yellow
if (!(Test-Path "$ProjectRoot/node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ npm install failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  ✅ Dependencies installed" -ForegroundColor Green

# Step 3: Build the application
Write-Host "`n[3/5] Building Windows application..." -ForegroundColor Yellow
Write-Host "  (This may take 3-5 minutes on first build)" -ForegroundColor Gray

if ($Dev) {
    Write-Host "  Building in development mode..." -ForegroundColor Gray
    npm run tauri-dev
} else {
    Write-Host "  Building in release mode..." -ForegroundColor Gray
    npm run tauri-build

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ Build completed" -ForegroundColor Green
}

# Step 4: Locate installer
Write-Host "`n[4/5] Locating installer..." -ForegroundColor Yellow

$installerPath = Get-ChildItem -Path "$ProjectRoot/src-tauri/target/release/bundle/nsis" -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($installerPath) {
    Write-Host "  ✅ Installer: $($installerPath.FullName)" -ForegroundColor Green
    Write-Host "  📦 Size: $([Math]::Round($installerPath.Length / 1MB, 2)) MB" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ Installer not found in expected location" -ForegroundColor Yellow
    Write-Host "  Check build output above for errors" -ForegroundColor Yellow
}

# Step 5: Summary and next steps
Write-Host "`n[5/5] Build Summary" -ForegroundColor Yellow

Write-Host @"
╭─── Success! ───╮
│ ✅ App built   │
│ ✅ Ready to    │
│    distribute  │
╰────────────────╯

📋 What's Next:

1. TEST THE APP:
   Double-click the installer:
   $($installerPath.FullName)

   Or run directly:
   $(if ($installerPath) { "$($ProjectRoot)\src-tauri\target\release\llm-bench.exe" })

2. OPTIONAL - CODE SIGNING:
   See WINDOWS_APP.md for code signing instructions
   (eliminates warnings for enterprise distribution)

3. DISTRIBUTE:
   - GitHub Releases
   - Microsoft Store
   - Direct download

📚 DOCUMENTATION:
   - WINDOWS_APP.md: Complete build & deployment guide
   - USAGE.md: CLI usage (if using command line)

🔗 Repository:
   https://github.com/priyansh19/Local-LLM-Bench
"@ -ForegroundColor Green

# Open folder if requested
if ($OpenFolder -and $installerPath) {
    Write-Host "Opening installer folder..." -ForegroundColor Gray
    Invoke-Item $installerPath.Directory
}

Write-Host "`n✨ Windows app ready for installation!" -ForegroundColor Cyan
