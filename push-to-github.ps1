# push-to-github.ps1
# Automates building, pushing to GitHub, and deploying to Vercel for both the user and AI agents.
# Reads credentials from `secrets.local` in the project root.

$PSScriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$secretsPath = Join-Path $PSScriptRoot "secrets.local"

if (-not (Test-Path $secretsPath)) {
    Write-Error "secrets.local file not found in project root."
    Write-Host "Please create a 'secrets.local' file in the project root containing your GitHub and Vercel tokens."
    Exit 1
}

# Parse JSON secrets
try {
    $secrets = Get-Content $secretsPath -Raw | ConvertFrom-Json
} catch {
    Write-Error "Failed to parse secrets.local. Please ensure it is valid JSON."
    Exit 1
}

$gitToken = $secrets.GITHUB_TOKEN
$vercelToken = $secrets.VERCEL_TOKEN

if (-not $gitToken -or $gitToken -eq "YOUR_GITHUB_TOKEN_HERE" -or $gitToken -eq "github_pat_antigravitydummytoken") {
    Write-Error "Please configure a valid GITHUB_TOKEN in secrets.local."
    Exit 1
}

Write-Host "Running local build to verify code before pushing..."
cmd.exe /c npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Local build failed! Please fix compiler errors before pushing."
    Exit 1
}

Write-Host "Local build succeeded. Pushing to GitHub..."
$remoteUrl = "https://$gitToken@github.com/3esign/3DPrinterFPS.git"

$env:GIT_DIR = ".gitlocal"
$env:GIT_WORK_TREE = "."
& "C:\Program Files\Git\cmd\git.exe" push $remoteUrl main

if ($LASTEXITCODE -ne 0) {
    Write-Error "Git push failed. Please verify your token in secrets.local."
    Exit 1
}

Write-Host "[SUCCESS] Pushed successfully to GitHub!"

if ($vercelToken) {
    Write-Host "Deploying directly to Vercel..."
    cmd.exe /c npx vercel --token $vercelToken --prod --yes
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] Deployed successfully to Vercel! Your site is updated."
    } else {
        Write-Error "Vercel deployment failed. Please check your Vercel token."
    }
} else {
    Write-Warning "No Vercel token configured in secrets.local. Skipping direct Vercel deployment."
}
