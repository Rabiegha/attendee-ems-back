# 🛑 Script d'arrêt EMS + Cloudflare Tunnel

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🛑 ARRÊT DÉMO EMS + CLOUDFLARE TUNNEL" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent (Split-Path -Parent $scriptDir)

# 1. Arrêter Cloudflare Tunnel
Write-Host "☁️  Arrêt de Cloudflare Tunnel..." -ForegroundColor Yellow
$cloudflared = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if ($cloudflared) {
    Stop-Process -Name "cloudflared" -Force
    Write-Host "✅ Cloudflare Tunnel arrêté" -ForegroundColor Green
} else {
    Write-Host "⚠️  Cloudflare Tunnel n'était pas actif" -ForegroundColor Yellow
}
Write-Host ""

# 2. Arrêter le Reverse Proxy (Node.js)
Write-Host "🔄 Arrêt du Reverse Proxy..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*reverse-proxy.js*"
}
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "✅ Reverse Proxy arrêté" -ForegroundColor Green
} else {
    Write-Host "⚠️  Reverse Proxy n'était pas actif" -ForegroundColor Yellow
}
Write-Host ""

# 3. Arrêter Docker (Backend + PostgreSQL)
Write-Host "📦 Arrêt de Docker..." -ForegroundColor Yellow
Set-Location "$rootDir\attendee-ems-back"
docker-compose -f docker-compose.dev.yml down
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker arrêté" -ForegroundColor Green
} else {
    Write-Host "⚠️  Erreur lors de l'arrêt de Docker" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ DÉMO ARRÊTÉE" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Fermez les fenêtres PowerShell ouvertes manuellement" -ForegroundColor Gray
Write-Host "💡 Le frontend (Vite) doit être arrêté manuellement si lancé" -ForegroundColor Gray
Write-Host ""
