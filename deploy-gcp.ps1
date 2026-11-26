# ==============================================================================
# S.I.G.O. — Script de Despliegue Automatizado en Google Cloud Run (Santiago, CL)
# Proyecto GCP: project-6f0b8b46-17fb-46e6-90a | Región: southamerica-west1
# ==============================================================================
$ErrorActionPreference = "Stop"

$GCLOUD = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $GCLOUD)) {
    $GCLOUD = "gcloud"
}

$PROJECT_ID = "project-6f0b8b46-17fb-46e6-90a"
$REGION = "southamerica-west1"
$API_URL = "https://sigo-api-243815551696.southamerica-west1.run.app"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 1. Desplegando Backend (sigo-api) en Google Cloud Run..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Push-Location "$PSScriptRoot\Proyecto\sigo-api"
& $GCLOUD run deploy sigo-api `
    --source . `
    --project=$PROJECT_ID `
    --region=$REGION `
    --allow-unauthenticated `
    --port=8080 `
    --min-instances=1 `
    --max-instances=1 `
    --no-cpu-throttling `
    --quiet
Pop-Location

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " 2. Compilando y Desplegando Consola Web (sigo-cl)..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Push-Location "$PSScriptRoot\Proyecto\frontend"
$env:API_BASE_URL = "$API_URL/api/v1"
node scripts/set-env.js --prod
npx ng build --configuration=production

& $GCLOUD run deploy sigo-cl `
    --source . `
    --project=$PROJECT_ID `
    --region=$REGION `
    --allow-unauthenticated `
    --port=8080 `
    --max-instances=3 `
    --quiet
Pop-Location

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " 3. Compilando y Desplegando Landing Page (landingpage-sigo-cl)..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Push-Location "$PSScriptRoot\Proyecto\sigo-landing"
npm run build

& $GCLOUD run deploy landingpage-sigo-cl `
    --source . `
    --project=$PROJECT_ID `
    --region=$REGION `
    --allow-unauthenticated `
    --port=8080 `
    --max-instances=3 `
    --quiet
Pop-Location

Write-Host "`n✅ Despliegue completado exitosamente en Google Cloud Run ($REGION)." -ForegroundColor Green
Write-Host "   • API Táctica 24/7: https://sigo-api-243815551696.southamerica-west1.run.app" -ForegroundColor Green
Write-Host "   • Consola Web:      https://sigo-cl-243815551696.southamerica-west1.run.app" -ForegroundColor Green
Write-Host "   • Landing Page:     https://landingpage-sigo-cl-243815551696.southamerica-west1.run.app" -ForegroundColor Green
