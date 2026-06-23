# push-to-github.ps1
# Automates pushing code to GitHub for both the user and AI agents.
# Reads the GitHub Personal Access Token from `secrets.local` in the project root.

$PSScriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$secretsPath = Join-Path $PSScriptRoot "secrets.local"

if (-not (Test-Path $secretsPath)) {
    Write-Error "secrets.local file not found in project root."
    Write-Host "Please create a 'secrets.local' file in the project root containing your GitHub Personal Access Token."
    Exit 1
}

$token = (Get-Content $secretsPath -Raw).Trim()
if ($token -eq "" -or $token -eq "YOUR_GITHUB_TOKEN_HERE" -or $token -eq "github_pat_antigravitydummytoken") {
    Write-Error "Please edit 'secrets.local' and put your valid GitHub Personal Access Token there."
    Exit 1
}

Write-Host "Running local build to verify code before pushing..."
cmd.exe /c npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Local build failed! Please fix compiler errors before pushing."
    Exit 1
}

Write-Host "Local build succeeded. Pushing to GitHub..."
$remoteUrl = "https://$token@github.com/3esign/3DPrinterFPS.git"

$env:GIT_DIR = ".gitlocal"
$env:GIT_WORK_TREE = "."
& "C:\Program Files\Git\cmd\git.exe" push $remoteUrl main

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] Pushed successfully to GitHub! Vercel deployment will start automatically."
} else {
    Write-Error "Git push failed. Please verify your token in secrets.local."
}
