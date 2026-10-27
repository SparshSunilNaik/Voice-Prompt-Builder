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

Push-Location "extension"
npm install
npm run build
Pop-Location

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Warning "FFmpeg is not on PATH. Typed prompts work, but Chrome WebM voice conversion will fail."
}

Set-Location "backend"
& $Python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
