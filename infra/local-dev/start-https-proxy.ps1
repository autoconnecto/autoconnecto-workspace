# Starts Caddy on :443 for https://app.local.autoconnecto (Vite :5173 + API :3000).
# Install Caddy once: winget install CaddyServer.Caddy
# Keep this window open while developing.

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Get-Command caddy -ErrorAction SilentlyContinue)) {
  Write-Host "Caddy not found. Install with: winget install CaddyServer.Caddy" -ForegroundColor Red
  exit 1
}

Write-Host "Starting HTTPS proxy for https://app.local.autoconnecto (Ctrl+C to stop)..." -ForegroundColor Cyan
caddy run --config (Join-Path $repoRoot "infra\local-dev\Caddyfile")
