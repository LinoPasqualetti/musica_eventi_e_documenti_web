# sync-viewer.ps1
Write-Host "🔄 Sincronizzazione spartito-viewer.html..." -ForegroundColor Cyan

$source = "C:\musica_eventi_e_documenti\assets\html\spartito-viewer.html"
$dest = "C:\musica_eventi_e_documenti_web\frontend\public\tools\spartito-viewer.html"

if (Test-Path $source) {
    Copy-Item -Force $source $dest
    Write-Host "✅ Spartito-viewer sincronizzato!" -ForegroundColor Green
    Write-Host "📁 Sorgente: $source" -ForegroundColor Gray
    Write-Host "📁 Destinazione: $dest" -ForegroundColor Gray
} else {
    Write-Host "❌ Errore: File sorgente non trovato!" -ForegroundColor Red
    Write-Host "📁 Cercato in: $source" -ForegroundColor Yellow
}