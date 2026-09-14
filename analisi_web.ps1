# ============================================================
# ANALISI APP WEB (FRONTEND + BACKEND) - v3.0
# Cartella: C:\musica_eventi_e_documenti_web
# Report  : C:\musica_eventi_e_documenti_web\analisi_web.txt
# ============================================================

$root       = "C:\musica_eventi_e_documenti_web"
$outputFile = Join-Path $root "analisi_web.txt"

if (Test-Path $outputFile) { Remove-Item $outputFile }

function Write-Log {
    param([string]$text)
    Write-Host $text
    Add-Content -Path $outputFile -Value $text -Encoding UTF8
}

# Esclusioni cartelle
$excludeDirs = 'node_modules|\.git|\.vite|dist|build|\.next|\.nuxt|coverage|\.cache|\.turbo|__pycache__|\.venv|venv|env|\.idea|\.vscode'

# Esclusioni file (rumore)
$excludeFilePatterns = '\.(docx|doc|png|jpg|jpeg|gif|zip|7z|rar|bak|backup|old)$|^analisi_.*\.(txt|ps1)$|\.txt\.old$|^structure\.txt$|^web_key_files\.txt$|^struttura_.*\.txt$|^sync-viewer\.ps1$|^check-web\.ps1$|^dump_.*\.sql$|^sqlite3\.exe$'

function Is-NoiseFile {
    param([System.IO.FileInfo]$f)
    return ($f.Name -match $excludeFilePatterns)
}

function Is-BackupDb {
    param([System.IO.FileInfo]$f)
    return ($f.Name -match '\.(bak|bis|attuale|old.*|backup)$|old.*\.db$|\.db\.\d{4}-\d{2}-\d{2}|\.db\.\d{4}-\d{2}-\d{2}\s+backup$|pre_turso\.db$')
}

function Is-DumpFile {
    param([System.IO.FileInfo]$f)
    return ($f.Name -match '^dump_.*\.sql$|^dump_.*\.sqlite$|\.sql$' -and $f.Length -gt 100KB)
}

# --- INTESTAZIONE ---
Write-Log "============================================================"
Write-Log "ANALISI APP WEB (FRONTEND + BACKEND) - v3.0"
Write-Log "Cartella : $root"
Write-Log "Data     : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Log "============================================================"

if (-not (Test-Path $root)) {
    Write-Log "ERRORE: cartella non trovata."
    return
}

# ============================================================
# 1. STATO MIGRAZIONE TURSO
# ============================================================
Write-Log ""
Write-Log "========== STATO MIGRAZIONE TURSO =========="

$beDir = Join-Path $root "backend"
$feDir = Join-Path $root "frontend"

# 1a. .env con TURSO
$envFiles = Get-ChildItem -Path $root -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq '.env' -or $_.Name -like '.env.*' }
$tursoEnvFound = $false
$tursoEnvKeys  = @()
foreach ($e in $envFiles) {
    $lines = Get-Content $e.FullName -Encoding UTF8 -ErrorAction SilentlyContinue
    foreach ($l in $lines) {
        if ($l -match '^\s*(TURSO_[A-Z_]+)\s*=') {
            $tursoEnvFound = $true
            $tursoEnvKeys += $matches[1]
        }
    }
}
if ($tursoEnvFound) {
    Write-Log "[OK] Variabili TURSO_* trovate in .env:"
    $tursoEnvKeys | Sort-Object -Unique | ForEach-Object { Write-Log ("   - {0}=*** (mascherato)" -f $_) }
} else {
    Write-Log "[--] Nessuna variabile TURSO_* in .env"
}

# 1b. @libsql/client tra le dipendenze
$libsqlFound = $false
$bePkg = Join-Path $beDir "package.json"
if (Test-Path $bePkg) {
    try {
        $j = Get-Content $bePkg -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($sec in @('dependencies','devDependencies')) {
            if ($j.$sec) {
                $j.$sec.PSObject.Properties | Where-Object { $_.Name -match '@libsql|libsql' } |
                    ForEach-Object { $libsqlFound = $true; Write-Log ("[OK] Dipendenza: {0} {1}" -f $_.Name, $_.Value) }
            }
        }
    } catch {}
}
if (-not $libsqlFound) { Write-Log "[--] Nessuna dipendenza @libsql/client" }

# 1c. turso-sync.js
$tursoSyncPath = Join-Path $beDir "src\config\turso-sync.js"
$tursoSyncFound = Test-Path $tursoSyncPath
Write-Log ("[{0}] turso-sync.js: {1}" -f $(if ($tursoSyncFound) { "OK" } else { "--" }), $tursoSyncPath.Replace($root,"."))

# 1d. turso-sync.js è invocato in index.js?
$tursoActive = $false
$indexPath = Join-Path $beDir "src\index.js"
if (Test-Path $indexPath) {
    $indexContent = Get-Content $indexPath -Raw -Encoding UTF8
    if ($indexContent -match 'turso-sync|initTursoSync|@libsql') {
        $tursoActive = $true
        Write-Log "[OK] turso-sync.js INVOCATO in index.js  => Turso ATTIVO nel codice"
    } else {
        Write-Log "[--] turso-sync.js NON invocato in index.js  => Turso NON attivo nel codice"
    }
}

# 1e. File pre-Turso
$preTurso = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'pre_turso|_pre_turso\.db' }
if ($preTurso) {
    Write-Log "[OK] File pre-Turso (snapshot pre-migrazione):"
    $preTurso | ForEach-Object { Write-Log ("   - {0} ({1:N0} bytes)" -f $_.FullName.Replace($root,"."), $_.Length) }
} else {
    Write-Log "[--] Nessun file *_pre_turso.db"
}

# 1f. Conclusione automatica
Write-Log ""
Write-Log "--- CONCLUSIONE AUTOMATICA ---"
if ($tursoEnvFound -and $tursoActive) {
    Write-Log "STATO: Turso ATTIVO nel codice."
} elseif ($tursoEnvFound -and -not $tursoActive) {
    Write-Log "STATO: Turso CONFIGURATO ma NON cablato nel codice."
    Write-Log "       Il DB primario è ancora SQLite locale (vedi database.js)."
    Write-Log "       turso-sync.js esiste come modulo pronto ma non invocato."
} elseif (-not $tursoEnvFound -and $tursoSyncFound) {
    Write-Log "STATO: File turso-sync.js presente ma nessuna configurazione .env."
} else {
    Write-Log "STATO: Turso NON configurato."
}

# ============================================================
# 2. STRUTTURA CARTELLE
# ============================================================
Write-Log ""
Write-Log "========== STRUTTURA CARTELLE (max 4 livelli) =========="
Get-ChildItem -Path $root -Recurse -Depth 3 -Directory |
    Where-Object { $_.FullName -notmatch $excludeDirs } |
    Select-Object -ExpandProperty FullName |
    ForEach-Object { $_.Replace($root, ".") } |
    Sort-Object |
    ForEach-Object { Write-Log $_ }

# ============================================================
# 3. SUDDIVISIONE FRONTEND / BACKEND
# ============================================================
Write-Log ""
Write-Log "========== SUDDIVISIONE FRONTEND / BACKEND =========="
foreach ($pair in @(@{N="FRONTEND";P=$feDir}, @{N="BACKEND";P=$beDir})) {
    Write-Log "----- $($pair.N): $($pair.P) -----"
    if (Test-Path $pair.P) {
        $files = Get-ChildItem -Path $pair.P -Recurse -File |
            Where-Object { $_.FullName -notmatch $excludeDirs -and -not (Is-NoiseFile $_) }
        $size  = ($files | Measure-Object -Property Length -Sum).Sum
        Write-Log ("File: {0}  |  Size: {1} MB" -f $files.Count, [math]::Round($size/1MB, 2))
        Write-Log "Estensioni principali:"
        $files | Group-Object Extension | Sort-Object Count -Descending | Select-Object -First 10 |
            ForEach-Object { Write-Log ("  {0,-10} {1,5}" -f $_.Name, $_.Count) }
    } else {
        Write-Log "(cartella non trovata)"
    }
    Write-Log ""
}

# ============================================================
# 4. ELENCO FILE
# ============================================================
Write-Log "========== ELENCO FILE (percorso) =========="
Get-ChildItem -Path $root -Recurse -File |
    Where-Object { $_.FullName -notmatch $excludeDirs -and -not (Is-NoiseFile $_) } |
    Sort-Object FullName |
    ForEach-Object { Write-Log ($_.FullName.Replace($root, ".")) }

# ============================================================
# 5. DIPENDENZE
# ============================================================
Write-Log ""
Write-Log "========== DIPENDENZE =========="

function Show-Deps-Json {
    param([string]$path, [string]$label)
    Write-Log "--- ${label}: $path ---"
    try {
        $json = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
        $props = @()
        if ($json.dependencies)    { $json.dependencies.PSObject.Properties    | ForEach-Object { $props += [pscustomobject]@{Tipo="prod"; Pacchetto=$_.Name; Versione=$_.Value} } }
        if ($json.devDependencies) { $json.devDependencies.PSObject.Properties | ForEach-Object { $props += [pscustomobject]@{Tipo="dev";  Pacchetto=$_.Name; Versione=$_.Value} } }
        if ($json.scripts) {
            Write-Log "Scripts:"
            $json.scripts.PSObject.Properties | ForEach-Object { Write-Log ("  {0} => {1}" -f $_.Name, $_.Value) }
        }
        if ($props.Count -eq 0) { Write-Log "(nessuna dipendenza)" }
        else { $props | Sort-Object Tipo, Pacchetto -Unique |
               Format-Table -AutoSize | Out-String -Width 200 |
               ForEach-Object { $_.TrimEnd() -split "`n" } | ForEach-Object { Write-Log $_ } }
    } catch { Write-Log "[Errore parsing JSON: $_]" }
}

$fePkg = Join-Path $feDir "package.json"
if (Test-Path $fePkg) { Show-Deps-Json -path $fePkg -label "FRONTEND package.json" } else { Write-Log "(frontend/package.json non trovato)" }
Write-Log ""

$bePkg2 = Join-Path $beDir "package.json"
if (Test-Path $bePkg2) { Show-Deps-Json -path $bePkg2 -label "BACKEND package.json" } else { Write-Log "(backend/package.json non trovato)" }

# ============================================================
# 6. MODELLI / CLASSI BACKEND
# ============================================================
Write-Log ""
Write-Log "========== MODELLI / CLASSI BACKEND =========="
$modelsDir = Join-Path $beDir "src\models"
if (Test-Path $modelsDir) {
    $modelFiles = Get-ChildItem $modelsDir -Recurse -File -Filter *.js -ErrorAction SilentlyContinue
    foreach ($mf in $modelFiles) {
        $rel = $mf.FullName.Replace($root, ".")
        Write-Log ("{0}" -f $rel)
        try {
            foreach ($line in (Get-Content $mf.FullName -Encoding UTF8)) {
                if ($line -match 'sequelize\.define\s*\(\s*[''"]([A-Za-z0-9_]+)[''"]') {
                    Write-Log ("   - model (sequelize.define): $($matches[1])")
                }
                if ($line -match 'class\s+([A-Za-z_][A-Za-z0-9_]*)\s+extends\s+Model') {
                    Write-Log ("   - model (class): $($matches[1])")
                }
                if ($line -match 'Model\.init\s*\(\s*\{') {
                    Write-Log ("   - model (Model.init)")
                }
            }
        } catch {}
    }
} else {
    Write-Log "(cartella backend/src/models non trovata)"
}

# ============================================================
# 7. ROTTE API (Express)
# ============================================================
Write-Log ""
Write-Log "========== ROTTE API (Express) =========="
$routesDir = Join-Path $beDir "src\routes"
if (Test-Path $routesDir) {
    $routeFiles = Get-ChildItem $routesDir -Recurse -File -Filter *.js -ErrorAction SilentlyContinue
    foreach ($rf in $routeFiles) {
        $rel = $rf.FullName.Replace($root, ".")
        Write-Log ("{0}" -f $rel)
        try {
            foreach ($line in (Get-Content $rf.FullName -Encoding UTF8)) {
                if ($line -match 'router\.(get|post|put|patch|delete)\s*\(\s*[''"]([^''"]+)[''"]') {
                    Write-Log ("   {0,-6} {1}" -f $matches[1].ToUpper(), $matches[2])
                }
            }
        } catch {}
    }
} else {
    Write-Log "(cartella backend/src/routes non trovata)"
}

# ============================================================
# 8. MOUNT POINTS API
# ============================================================
Write-Log ""
Write-Log "========== MOUNT POINTS API =========="
if (Test-Path $indexPath) {
    try {
        foreach ($line in (Get-Content $indexPath -Encoding UTF8)) {
            if ($line -match 'app\.use\s*\(\s*[''"]([^''"]+)[''"]\s*,\s*([A-Za-z0-9_]+)') {
                Write-Log ("   {0,-25} <- {1}" -f $matches[1], $matches[2])
            }
        }
    } catch {}
} else {
    Write-Log "(index.js non trovato)"
}

# ============================================================
# 9. DEPLOY / PRODUZIONE
# ============================================================
Write-Log ""
Write-Log "========== DEPLOY / PRODUZIONE =========="

# 9a. File di deploy noti
$deployFiles = @(
    "Dockerfile","docker-compose.yml","docker-compose.yaml",".dockerignore",
    "Procfile","zeabur.json","koyeb.yaml","koyeb.yml","render.yaml","render.yml",
    "fly.toml","railway.json","railway.toml","vercel.json","netlify.toml",
    "app.json","nixpacks.toml",".platform.app.yaml"
)
$foundDeploy = @()
foreach ($df in $deployFiles) {
    $p1 = Join-Path $root $df
    $p2 = Join-Path $beDir $df
    $p3 = Join-Path $feDir $df
    if (Test-Path $p1) { $foundDeploy += $p1.Replace($root,".") }
    if (Test-Path $p2) { $foundDeploy += $p2.Replace($root,".") }
    if (Test-Path $p3) { $foundDeploy += $p3.Replace($root,".") }
}
if ($foundDeploy) {
    Write-Log "File di deploy trovati:"
    $foundDeploy | Sort-Object -Unique | ForEach-Object { Write-Log ("  - {0}" -f $_) }
} else {
    Write-Log "Nessun file di deploy noto (Docker/Zeabur/Koyeb/Render/Fly/Railway/Vercel/Netlify)."
}

# 9b. GitHub Actions
Write-Log ""
$wfDir = Join-Path $root ".github\workflows"
if (Test-Path $wfDir) {
    Write-Log "GitHub Actions workflows:"
    Get-ChildItem $wfDir -File -Filter *.yml -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Log ("  - {0}" -f $_.Name) }
    Get-ChildItem $wfDir -File -Filter *.yaml -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Log ("  - {0}" -f $_.Name) }
} else {
    Write-Log "GitHub Actions: nessun workflow"
}

# 9c. Riferimenti a NODE_ENV=production / PORT / HOST nel codice
Write-Log ""
Write-Log "Riferimenti a variabili di produzione nel codice (backend/src):"
$srcDir = Join-Path $beDir "src"
if (Test-Path $srcDir) {
    $hits = Select-String -Path (Join-Path $srcDir "*.js") -Pattern "NODE_ENV|process\.env\.PORT|process\.env\.HOST" -ErrorAction SilentlyContinue
    if ($hits) {
        $hits | Select-Object -First 20 | ForEach-Object {
            Write-Log ("  {0}:{1}  {2}" -f $_.Filename, $_.LineNumber, $_.Line.Trim())
        }
    } else {
        Write-Log "  (nessuno)"
    }
}

# 9d. .gitignore: pattern DB esclusi?
Write-Log ""
$gitignore = Join-Path $root ".gitignore"
if (Test-Path $gitignore) {
    Write-Log ".gitignore (pattern DB/asset rilevanti):"
    Get-Content $gitignore -Encoding UTF8 | Where-Object { $_ -match '\.db|data/|uploads/|dump|\.sql|\.env' } |
        ForEach-Object { Write-Log ("  {0}" -f $_) }
} else {
    Write-Log ".gitignore non trovato alla radice"
}

# ============================================================
# 10. DATABASE
# ============================================================
Write-Log ""
Write-Log "========== DATABASE =========="

# 10a. File DB/SQL (esclusi dump)
$dbFiles = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch $excludeDirs -and
        -not (Is-DumpFile $_) -and
        ($_.Extension -in '.db','.sqlite','.sqlite3','.db3' -or $_.Name -match '\.db\.')
    }
if ($dbFiles) {
    Write-Log "File DB rilevati:"
    $dbFiles | ForEach-Object {
        $tag = if (Is-BackupDb $_) { " [BACKUP]" } else { "" }
        Write-Log ("  {0} | {1:N0} bytes{2}" -f $_.FullName.Replace($root,"."), $_.Length, $tag)
    }
} else {
    Write-Log "Nessun file .db/.sqlite/.sql nel progetto."
}

# 10b. Driver DB
Write-Log ""
Write-Log "Driver/pacchetti DB tra le dipendenze:"
$dbKeywords = 'sqlite|sqlite3|better-sqlite3|libsql|pg|postgres|mysql|mysql2|mariadb|mongo|mongoose|prisma|sequelize|typeorm|knex|bookshelf|sqlalchemy|psycopg|pymongo|redis|supabase|firebase'
$found = @()
foreach ($cand in @((Join-Path $feDir "package.json"), (Join-Path $beDir "package.json"))) {
    if (Test-Path $cand) {
        try {
            $j = Get-Content $cand -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($sec in @('dependencies','devDependencies')) {
                if ($j.$sec) {
                    $j.$sec.PSObject.Properties | Where-Object { $_.Name -match $dbKeywords } |
                        ForEach-Object { $found += ("{0} ({1})" -f $_.Name, $_.Value) }
                }
            }
        } catch {}
    }
}
if ($found.Count -eq 0) { Write-Log "  (nessuno)" }
else { $found | Sort-Object -Unique | ForEach-Object { Write-Log ("  - {0}" -f $_) } }

# 10c. Configurazioni DB (stringhe di connessione)
Write-Log ""
Write-Log "Configurazioni DB (stringhe di connessione in .env / config):"
$envConfigFiles = Get-ChildItem -Path $root -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch $excludeDirs -and
        ($_.Name -eq '.env' -or $_.Name -like '.env.*' -or $_.Name -like '*.env' -or
         $_.Name -match 'database\.(js|ts|py|json|yml|yaml)$' -or $_.Name -match 'db\.(js|ts|py|json)$' -or
         $_.Name -match '^check-db\.js$' -or $_.Name -match 'turso.*\.js$')
    }
if ($envConfigFiles.Count -eq 0) { Write-Log "  (nessuno)" }
else {
    foreach ($e in $envConfigFiles) {
        Write-Log ("  --- {0} ---" -f $e.FullName.Replace($root,"."))
        Get-Content $e.FullName -TotalCount 40 -Encoding UTF8 -ErrorAction SilentlyContinue |
            Where-Object { $_ -match 'DB_|DATABASE|POSTGRES|MYSQL|MONGO|SQLITE|TURSO|LIBSQL|HOST|PORT|URL|CONN|STORAGE|DIALECT' } |
            ForEach-Object { Write-Log ("     {0}" -f $_) }
    }
}

# ============================================================
# 11. SCHEMA DB (sqlite3.exe)
# ============================================================
Write-Log ""
Write-Log "========== SCHEMA DB =========="

$activeDb = Join-Path $beDir "data\musica_eventi_e_documenti_web.db"
$sqliteExe = Join-Path $beDir "sqlite3.exe"

if ((Test-Path $activeDb) -and (Test-Path $sqliteExe)) {
    Write-Log "DB attivo: $($activeDb.Replace($root,'.'))"
    try {
        # Tabelle
        $tables = & $sqliteExe $activeDb ".tables" 2>$null
        if ($tables) {
            Write-Log ""
            Write-Log "Tabelle:"
            ($tables -split '\s+') | Where-Object { $_ -ne '' } | Sort-Object |
                ForEach-Object { Write-Log ("  - {0}" -f $_) }

            Write-Log ""
            Write-Log "Conteggio righe per tabella:"
            $tableList = ($tables -split '\s+') | Where-Object { $_ -ne '' }
            foreach ($t in $tableList) {
                try {
                    $count = & $sqliteExe $activeDb "SELECT COUNT(*) FROM $t;" 2>$null
                    Write-Log ("  {0,-30} {1,8}" -f $t, ($count | Select-Object -First 1))
                } catch {
                    Write-Log ("  {0,-30} (errore)" -f $t)
                }
            }
        } else {
            Write-Log "(nessuna tabella letta)"
        }
    } catch {
        Write-Log "[Errore esecuzione sqlite3.exe: $_]"
    }
} else {
    if (-not (Test-Path $activeDb)) { Write-Log "(DB attivo non trovato: $activeDb)" }
    if (-not (Test-Path $sqliteExe)) { Write-Log "(sqlite3.exe non trovato in backend/)" }
}

# ============================================================
# 12. DUMP / EXPORT
# ============================================================
Write-Log ""
Write-Log "========== DUMP / EXPORT =========="
$dumpFiles = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch $excludeDirs -and
        ($_.Name -match '^dump_.*\.(sql|sqlite|db)$' -or
         $_.Name -match '\.sql$' -or
         $_.Name -match 'pre_turso\.db$' -or
         $_.Name -match '\.(zip|tar|gz)$')
    }
if ($dumpFiles) {
    Write-Log "File di dump/export (esclusi dal conteggio DB):"
    $dumpFiles | Sort-Object Length -Descending | ForEach-Object {
        Write-Log ("  {0} | {1:N2} MB" -f $_.FullName.Replace($root,"."), ($_.Length/1MB))
    }
} else {
    Write-Log "(nessun dump/export)"
}

# ============================================================
# 13. DIMENSIONI SEPARATE
# ============================================================
Write-Log ""
Write-Log "========== DIMENSIONI SEPARATE =========="

$allFiles = Get-ChildItem -Path $root -Recurse -File |
    Where-Object { $_.FullName -notmatch $excludeDirs }

$codeExts = @('.js','.jsx','.ts','.tsx','.json','.css','.scss','.html','.md','.yml','.yaml')
$assetExts = @('.png','.jpg','.jpeg','.gif','.svg','.pdf','.mxl','.kar','.mid','.mp3','.wav','.abc','.xml','.woff','.woff2','.ttf')
$binExts = @('.exe','.dll','.bin')

$codeFiles  = $allFiles | Where-Object { $codeExts -contains $_.Extension -and -not (Is-NoiseFile $_) -and -not ($_.FullName -match '\\uploads\\') -and -not (Is-DumpFile $_) }
$assetFiles = $allFiles | Where-Object { $assetExts -contains $_.Extension -or $_.FullName -match '\\uploads\\' }
$dumpFiles2 = $allFiles | Where-Object { Is-DumpFile $_ }
$backupFiles = $allFiles | Where-Object { Is-BackupDb $_ }
$binFiles   = $allFiles | Where-Object { $binExts -contains $_.Extension }

function Sum-MB {
    param($files)
    if (-not $files) { return 0 }
    return [math]::Round((($files | Measure-Object -Property Length -Sum).Sum)/1MB, 2)
}

Write-Log ("Codice (js/jsx/json/css/html/md/yml)     : {0,8} file  |  {1,8} MB" -f $codeFiles.Count, (Sum-MB $codeFiles))
Write-Log ("Asset (img/pdf/mxl/kar/mid/mp3 + uploads): {0,8} file  |  {1,8} MB" -f $assetFiles.Count, (Sum-MB $assetFiles))
Write-Log ("Dump/Export (dump_*.sql, *.zip, pre_turso): {0,8} file  |  {1,8} MB" -f $dumpFiles2.Count, (Sum-MB $dumpFiles2))
Write-Log ("Backup DB (.bak/.bis/.attuale/old*)      : {0,8} file  |  {1,8} MB" -f $backupFiles.Count, (Sum-MB $backupFiles))
Write-Log ("Binari (.exe/.dll)                       : {0,8} file  |  {1,8} MB" -f $binFiles.Count, (Sum-MB $binFiles))

# ============================================================
# 14. RIEPILOGO
# ============================================================
Write-Log ""
Write-Log "============================================================"
Write-Log "RIEPILOGO"
Write-Log "============================================================"
$allDirs = Get-ChildItem -Path $root -Recurse -Directory | Where-Object { $_.FullName -notmatch $excludeDirs }
$sizeTot = ($allFiles | Measure-Object -Property Length -Sum).Sum

Write-Log "Cartelle              : $($allDirs.Count)"
Write-Log "File totali (grezzi)  : $($allFiles.Count)"
Write-Log "Dimensione totale     : $([math]::Round($sizeTot/1MB, 2)) MB"
Write-Log ""
Write-Log "Report salvato in     : $outputFile"
Write-Log "============================================================"