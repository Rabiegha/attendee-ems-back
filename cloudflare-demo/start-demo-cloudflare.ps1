# 🚀 Script de démarrage EMS avec Cloudflare Tunnel

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 DÉMARRAGE DÉMO EMS + CLOUDFLARE TUNNEL" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent (Split-Path -Parent $scriptDir)

# Vérifier si cloudflared est installé
Write-Host "🔍 Vérification de Cloudflare Tunnel..." -ForegroundColor Yellow
$cloudflaredInstalled = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflaredInstalled) {
    Write-Host "❌ cloudflared n'est pas installé ou le terminal doit être redémarré !" -ForegroundColor Red
    Write-Host ""
    Write-Host "📦 Installation :" -ForegroundColor Yellow
    Write-Host "  winget install Cloudflare.cloudflared" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  Après l'installation, redémarrez ce terminal !" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "✅ cloudflared installé" -ForegroundColor Green
Write-Host ""

# 1. Démarrer Docker (PostgreSQL + Backend)
Write-Host "📦 Démarrage de Docker..." -ForegroundColor Yellow
Set-Location "$rootDir\attendee-ems-back"
docker-compose -f docker-compose.dev.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du démarrage de Docker" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker démarré (Backend + PostgreSQL)" -ForegroundColor Green
Start-Sleep -Seconds 5
Write-Host ""

# 2. Vérifier si le frontend tourne
Write-Host "🔍 Vérification du Frontend..." -ForegroundColor Yellow
$frontendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -ErrorAction SilentlyContinue -TimeoutSec 2
    $frontendRunning = $true
    Write-Host "✅ Frontend déjà actif sur http://localhost:5173" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Frontend non actif" -ForegroundColor Yellow
    Write-Host "   Lancez-le manuellement : cd attendee-ems-front; npm run dev" -ForegroundColor White
}
Write-Host ""

# 3. Démarrer le Reverse Proxy
Write-Host "🔄 Démarrage du Reverse Proxy..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$scriptDir'; Write-Host 'Reverse Proxy sur port 8080...' -ForegroundColor Cyan; node reverse-proxy.js" -WindowStyle Normal
Write-Host "⏳ Attente du démarrage..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Vérifier si le reverse proxy répond
$proxyReady = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $testConnection = Test-NetConnection -ComputerName localhost -Port 8080 -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($testConnection) {
            $proxyReady = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if ($proxyReady) {
    Write-Host "✅ Reverse Proxy démarré sur http://localhost:8080" -ForegroundColor Green
} else {
    Write-Host "❌ Le Reverse Proxy n'a pas démarré correctement" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. Démarrer Cloudflare Tunnel
Write-Host "☁️  Démarrage de Cloudflare Tunnel..." -ForegroundColor Yellow
Write-Host "   Mode: Quick (URL temporaire)" -ForegroundColor Gray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cloudflared tunnel --url http://localhost:8080" -WindowStyle Normal
Write-Host "⏳ Attente de l'initialisation du tunnel..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "🎉 DÉMO EMS PRÊTE !" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "☁️  URL CLOUDFLARE" -ForegroundColor Cyan
Write-Host "   Regardez la fenêtre 'cloudflared' pour voir l'URL" -ForegroundColor White
Write-Host "   Format: https://xxxxx.trycloudflare.com" -ForegroundColor Gray
Write-Host ""
Write-Host "📍 URLs LOCALES" -ForegroundColor Cyan
Write-Host "   Reverse Proxy : http://localhost:8080" -ForegroundColor White
Write-Host "   Frontend      : http://localhost:5173" -ForegroundColor White
Write-Host "   Backend       : http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "✨ Avantages Cloudflare :" -ForegroundColor Yellow
Write-Host "   ♾️  Aucune limite de requêtes" -ForegroundColor White
Write-Host "   ⚡ Très rapide (réseau Cloudflare)" -ForegroundColor White
Write-Host "   🔒 HTTPS automatique" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT : Gardez 2 fenêtres ouvertes :" -ForegroundColor Yellow
Write-Host "   1. Reverse Proxy (Node.js)" -ForegroundColor White
Write-Host "   2. Cloudflare Tunnel" -ForegroundColor White
Write-Host ""
Write-Host "🛑 Pour arrêter : .\stop-demo-cloudflare.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Cette fenêtre peut être fermée" -ForegroundColor Gray
Write-Host ""
