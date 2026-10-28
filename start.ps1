$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example. Add provider keys before live API use." -ForegroundColor Yellow
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    python -m venv .venv
}

$Python = Join-Path $Root ".venv\Scripts\python.exe"
& $Python -m pip install -r "backend\requirements.txt"
if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed." }

Push-Location "extension"
npm ci
if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed." }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Extension build failed." }
Pop-Location

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Warning "FFmpeg is not on PATH. Typed prompts work, but Chrome WebM voice conversion will fail."
}

Set-Location "backend"
& $Python -m app.launch
