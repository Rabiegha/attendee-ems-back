# Script de demarrage Cloudflare Demo
Write-Host "Demarrage Docker..." -ForegroundColor Yellow
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back
docker-compose -f docker-compose.dev.yml up -d
Start-Sleep -Seconds 5

Write-Host "Demarrage Reverse Proxy..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\Corentin\Documents\EMS\attendee-ems-back\cloudflare-demo; node reverse-proxy.js"
Start-Sleep -Seconds 3

Write-Host "Demarrage Cloudflare Tunnel..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); cloudflared tunnel --url http://localhost:8080"

Write-Host "DEMO PRETE !" -ForegroundColor Green
Write-Host "Regardez la fenetre Cloudflare pour voir l'URL" -ForegroundColor Cyan
