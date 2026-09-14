# check-web.ps1
param(
    [string]$Base    = "http://localhost:5000/api",
    [string]$EventId = "1785673024029"
)

function Write-Section($t) { Write-Host "`n===== $t =====" -ForegroundColor Cyan }

Write-Section "1. Health check"
try {
    $health = Invoke-RestMethod -Uri "$Base/health" -Method GET -TimeoutSec 5
    Write-Host "OK" -ForegroundColor Green
    $health | ConvertTo-Json
} catch {
    Write-Host "ERRORE: backend non raggiungibile su $Base" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Section "2. Lista eventi"
try {
    $events = Invoke-RestMethod -Uri "$Base/events" -Method GET
    Write-Host "Eventi trovati: $($events.Count)" -ForegroundColor Green
    $events | Select-Object -First 5 | Format-Table id, title, date -AutoSize
} catch {
    Write-Host "ERRORE /events: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Section "3. Dettaglio evento $EventId"
try {
    $ev = Invoke-RestMethod -Uri "$Base/events/$EventId" -Method GET
    $ev | ConvertTo-Json -Depth 4
} catch {
    Write-Host "ERRORE /events/$EventId : $($_.Exception.Message)" -ForegroundColor Red
}

Write-Section "4. Brani dell'evento $EventId"
$songIds = @()
try {
    $songs = Invoke-RestMethod -Uri "$Base/events/$EventId/songs" -Method GET
    if ($songs.Count -eq 0) {
        Write-Host "Nessun brano" -ForegroundColor Yellow
    } else {
        Write-Host "Brani trovati: $($songs.Count)" -ForegroundColor Green
        $songs | Format-Table -AutoSize
        $songIds = $songs | ForEach-Object { $_.id } | Select-Object -Unique
        Write-Host "Song IDs: $($songIds -join ', ')" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERRORE /events/$EventId/songs : $($_.Exception.Message)" -ForegroundColor Red
}

Write-Section "5. Documenti per ciascun brano"
foreach ($sid in $songIds) {
    try {
        $docs = Invoke-RestMethod -Uri "$Base/events/$EventId/songs/$sid/documents" -Method GET
        Write-Host "`n-- songId=$sid  ($($docs.Count) documenti)" -ForegroundColor Yellow
        if ($docs.Count -gt 0) {
            $docs | Format-Table id, doc_type, file_name -AutoSize
        }
    } catch {
        Write-Host "  ERRORE songId=$sid : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Section "6. Content-Type dei documenti"
# Prende i primi documenti di ogni song e ne testa il content
foreach ($sid in $songIds) {
    try {
        $docs = Invoke-RestMethod -Uri "$Base/events/$EventId/songs/$sid/documents" -Method GET
        foreach ($d in $docs) {
            try {
                $h = Invoke-WebRequest -Uri "$Base/documents/$($d.id)/content" -Method Head -TimeoutSec 5
                Write-Host ("  {0,-12} {1,-40} -> {2} ({3} bytes)" -f `
                    $d.doc_type, $d.file_name, $h.Headers['Content-Type'], $h.Headers['Content-Length'])
            } catch {
                Write-Host "  $($d.file_name): HEAD fallito - $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } catch { }
}

Write-Host "`nDone." -ForegroundColor Cyan