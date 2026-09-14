# ============================================================
# SCRIPT DI ANALISI BACKEND - C:\musica_eventi_e_documenti_web
# ============================================================

$root = "C:\musica_eventi_e_documenti_web"
$outputFile = "$env:USERPROFILE\Desktop\analisi_backend.txt"

# Pulisci il file di output se esiste
if (Test-Path $outputFile) { Remove-Item $outputFile }

# Funzione per scrivere sia a video che su file
function Write-Log {
    param([string]$text)
    Write-Host $text
    Add-Content -Path $outputFile -Value $text
}

# --- 1. INTESTAZIONE ---
Write-Log "============================================================"
Write-Log "ANALISI BACKEND - $root"
Write-Log "Data analisi: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Log "============================================================"
Write-Log ""

# --- 2. VERIFICA ESISTENZA CARTELLA ---
if (-not (Test-Path $root)) {
    Write-Log "ERRORE: La cartella $root NON esiste!"
    return
}
Write-Log "[OK] La cartella esiste."
Write-Log ""

# --- 3. STRUTTURA AD ALBERO (fino a 4 livelli, escludendo node_modules) ---
Write-Log "========== STRUTTURA CARTELLE (max 4 livelli) =========="
$tree = Get-ChildItem -Path $root -Recurse -Depth 3 -Directory |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git|\.vite|dist|build' } |
    Select-Object -ExpandProperty FullName |
    ForEach-Object { $_.Replace($root, ".") } |
    Sort-Object

$tree | ForEach-Object { Write-Log $_ }
Write-Log ""

# --- 4. CONTEGGIO PER TIPO DI FILE ---
Write-Log "========== CONTEGGIO FILE PER ESTENSIONE =========="
Get-ChildItem -Path $root -Recurse -File |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git|\.vite' } |
    Group-Object Extension |
    Sort-Object Count -Descending |
    ForEach-Object {
        Write-Log ("{0,-15} {1,6} file" -f $_.Name, $_.Count)
    }
Write-Log ""

# --- 5. ELENCO COMPLETO FILE (con dimensione e data) ---
Write-Log "========== ELENCO FILE (percorso | dimensione | data modifica) =========="
Get-ChildItem -Path $root -Recurse -File |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git|\.vite' } |
    Sort-Object FullName |
    ForEach-Object {
        $relPath = $_.FullName.Replace($root, ".")
        $size = "{0,10:N0} bytes" -f $_.Length
        $date = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
        Write-Log ("{0} | {1} | {2}" -f $relPath, $size, $date)
    }
Write-Log ""

# --- 6. FILE DI CONFIGURAZIONE / README (contenuto) ---
Write-Log "========== CONTENUTO FILE DI CONFIGURAZIONE E README =========="
$configFiles = Get-ChildItem -Path $root -Recurse -File |
    Where-Object {
        $_.FullName -notmatch 'node_modules|\.git|\.vite' -and
        ($_.Name -match '\.(json|md|txt|xml|yml|yaml|ini|config|env)$' -or
         $_.Name -match '^(README|LICENSE|CHANGELOG)')
    } |
    Where-Object { $_.Length -lt 100KB }   # salta file enormi

foreach ($f in $configFiles) {
    $relPath = $f.FullName.Replace($root, ".")
    Write-Log "--------- FILE: $relPath ---------"
    try {
        Get-Content -Path $f.FullName -TotalCount 100 -ErrorAction Stop |
            ForEach-Object { Write-Log $_ }
    } catch {
        Write-Log "[Impossibile leggere il file: $_]"
    }
    Write-Log ""
}

# --- 7. RIEPILOGO FINALE ---
Write-Log "============================================================"
Write-Log "RIEPILOGO"
Write-Log "============================================================"
$totalFiles = (Get-ChildItem -Path $root -Recurse -File |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git|\.vite' }).Count
$totalDirs = (Get-ChildItem -Path $root -Recurse -Directory |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git|\.vite' }).Count
$totalSize = (Get-ChildItem -Path $root -Recurse -File |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git|\.vite' } |
    Measure-Object -Property Length -Sum).Sum

Write-Log "Cartella analizzata : $root"
Write-Log "Numero cartelle     : $totalDirs"
Write-Log "Numero file         : $totalFiles"
Write-Log "Dimensione totale   : $([math]::Round($totalSize/1MB, 2)) MB"
Write-Log ""
Write-Log "Report salvato in   : $outputFile"
Write-Log "============================================================"