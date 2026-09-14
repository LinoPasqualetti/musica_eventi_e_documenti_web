# Guida al Deploy — Musica Eventi e Documenti Web

Guida operativa per gestire l'app su Fly.io: deploy, aggiornamento DB,
troubleshooting e comandi utili.

## Indice

1. [Setup iniziale](#setup-iniziale)
2. [Deploy del codice](#deploy-del-codice)
3. [Aggiornamento del database](#aggiornamento-del-database)
4. [Gestione dell'app](#gestione-dellapp)
5. [Troubleshooting](#troubleshooting)
6. [Configurazione](#configurazione)
7. [Comandi di riferimento](#comandi-di-riferimento)

---

## Setup iniziale

### Prerequisiti
- Docker Desktop installato e avviato
- flyctl installato (in `%USERPROFILE%\.fly\bin\flyctl.exe`)
- Autenticazione Fly effettuata: `flyctl auth login`

### Se `flyctl` non è nel PATH

In PowerShell, ridefinisci la funzione per la sessione corrente:

    function flyctl { & "$env:USERPROFILE\.fly\bin\flyctl.exe" @args }

Oppure aggiungi al PATH in modo permanente:

    $flyPath = "$env:USERPROFILE\.fly\bin"
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$flyPath", "User")
    # Chiudi e riapri PowerShell

---

## Deploy del codice

### Procedura standard

Quando modifichi il codice (backend o frontend) e vuoi aggiornare l'app in produzione:

**1. Se hai modificato il frontend, ricompilalo:**

    cd C:\musica_eventi_e_documenti_web\frontend
    npm run build

Questo rigenera la cartella `frontend/dist/` con i file ottimizzati.

**2. Fai il deploy:**

    cd C:\musica_eventi_e_documenti_web
    flyctl deploy --local-only

Il comando:
- Verifica `fly.toml`
- Costruisce l'immagine Docker (backend + frontend)
- La carica su Fly.io
- Aggiorna la macchina in produzione

**Tempi tipici:** 2-5 minuti.

### Solo backend (senza modifiche frontend)

Se hai modificato solo il backend:

    cd C:\musica_eventi_e_documenti_web
    flyctl deploy --local-only

Non serve rifare il build del frontend.

### Solo frontend (senza modifiche backend)

Se hai modificato solo il frontend:

    cd C:\musica_eventi_e_documenti_web\frontend
    npm run build

    cd C:\musica_eventi_e_documenti_web
    flyctl deploy --local-only

Il Dockerfile includerà il nuovo `dist/`.

### Verifica del deploy

    flyctl status -a musica-eventi-e-documenti-web
    flyctl logs -a musica-eventi-e-documenti-web --no-tail

Testa con:

    Invoke-WebRequest "https://musica-eventi-e-documenti-web.fly.dev/api/health" -UseBasicParsing

---

## Aggiornamento del database

**ATTENZIONE**: Il DB di produzione NON si aggiorna automaticamente quando modifichi
quello locale. Devi copiarlo manualmente sul volume Fly.

### Quando serve

- Dopo aver aggiunto/modificato eventi, brani o documenti nell'app desktop Flutter
- Dopo aver modificato lo schema del DB (nuove tabelle, colonne)
- Dopo aver corretto dati direttamente nel DB locale

### Procedura

**1. Ferma la macchina (per evitare conflitti sul DB):**

    flyctl machine stop 2873245c4659e8 -a musica-eventi-e-documenti-web

**2. Attendi 10 secondi:**

    Start-Sleep -Seconds 10

**3. Avvia la macchina (per abilitare SFTP):**

    flyctl machine start 2873245c4659e8 -a musica-eventi-e-documenti-web

**4. Attendi 20 secondi che sia pronta:**

    Start-Sleep -Seconds 20

**5. Rimuovi il DB vecchio dal volume:**

    flyctl ssh console -a musica-eventi-e-documenti-web

Poi nella shell Linux:

    rm -f /data/musica_eventi_e_documenti_web.db*
    exit

**6. Copia il nuovo DB:**

    cd C:\musica_eventi_e_documenti_web\backend
    flyctl ssh sftp put "data\musica_eventi_e_documenti_web.db" "/data/musica_eventi_e_documenti_web.db" -a musica-eventi-e-documenti-web

**7. Riavvia la macchina:**

    flyctl machine restart 2873245c4659e8 -a musica-eventi-e-documenti-web

**8. Verifica:**

    Start-Sleep -Seconds 30
    Invoke-WebRequest "https://musica-eventi-e-documenti-web.fly.dev/api/events" -UseBasicParsing

### Nota sul DB in uso

Il DB di produzione è: `backend/data/musica_eventi_e_documenti_web.db`
(sul tuo PC). Il backend in locale usa lo stesso file.

---

## Gestione dell'app

### Sospendere l'app (per non consumare credito)

    flyctl apps suspend musica-eventi-e-documenti-web

L'app non risponde ma i dati restano al sicuro. Puoi riattivarla quando vuoi.

### Riattivare l'app

    flyctl apps resume musica-eventi-e-documenti-web

### Riavviare la macchina

    flyctl machine restart 2873245c4659e8 -a musica-eventi-e-documenti-web

### Fermare la macchina (senza sospendere l'app)

    flyctl machine stop 2873245c4659e8 -a musica-eventi-e-documenti-web

### Avviare la macchina

    flyctl machine start 2873245c4659e8 -a musica-eventi-e-documenti-web

### Stato dettagliato

    flyctl status -a musica-eventi-e-documenti-web
    flyctl machine list -a musica-eventi-e-documenti-web

### Log in tempo reale

    flyctl logs -a musica-eventi-e-documenti-web

Premi `Ctrl+C` per uscire.

### Log senza tail (mostra gli ultimi ed esce)

    flyctl logs -a musica-eventi-e-documenti-web --no-tail

### Dashboard web

    flyctl dashboard -a musica-eventi-e-documenti-web

Apre il browser sulla dashboard di Fly per questa app.

---

## Troubleshooting

### L'app risponde 502 Bad Gateway

Cause possibili:
- La macchina si sta ancora avviando (aspetta 30-60 sec)
- La macchina è crashato (controlla `flyctl logs`)
- Il DB è corrotto o mancante

Soluzioni:
- Aspetta 1 minuto e riprova
- `flyctl machine restart 2873245c4659e8`
- Verifica i log: `flyctl logs -a musica-eventi-e-documenti-web --no-tail`

### Deploy fallisce con "Waiting for depot builder"

Il builder remoto è bloccato. Soluzione: usa il builder locale.

    flyctl deploy --local-only

### `npm ci` fallisce durante il build

Il `package-lock.json` è disallineato. Soluzione: modifica il Dockerfile,
cambiando `RUN npm ci --omit=dev` in `RUN npm install --omit=dev`.

### Docker non risponde

    docker ps

Se dà errore, avvia Docker Desktop dal menu Start e aspetta che l'icona
nella system tray diventi verde (30-90 secondi).

### SFTP put fallisce: "remote file already exists"

Il file esiste già sul volume. Soluzione: entra nella shell con
`flyctl ssh console`, cancella il file con `rm -f /data/...`, esci, e riprova.

### Il DB è vuoto dopo il deploy

Il volume Fly è persistente, ma se il DB non è mai stato copiato, è vuoto.
Segui la procedura "Aggiornamento del database" qui sopra.

### Out Of Memory (OOM)

Se la macchina viene uccisa per OOM (visibile nei log):
- Aumenta la RAM: `flyctl machine update 2873245c4659e8 --vm-memory 1024`
- Oppure ottimizza il codice per consumare meno memoria

### "no such table" nelle API

Il DB non contiene le tabelle. Cause:
- DB sbagliato copiato (es. DB vuoto)
- DB corrotto durante la copia

Soluzione: ricontrolla il DB locale con sqlite3 e ricopia.

---

## Configurazione

### File di configurazione

| File | Ruolo |
|---|---|
| `fly.toml` | Configurazione Fly (regione, RAM, volumi, auto-suspend) |
| `Dockerfile` | Come costruire l'immagine |
| `.dockerignore` | Cosa escludere dal build |
| `backend/.env` | Variabili ambiente sviluppo |
| `backend/.env.production` | Riferimento per i secrets di produzione (NON committare) |

### Secrets di Fly (variabili ambiente di produzione)

I secrets sono crittografati e non finiscono nel codice. Per vederli:

    flyctl secrets list -a musica-eventi-e-documenti-web

Per aggiungerne uno:

    flyctl secrets set NOME="valore" -a musica-eventi-e-documenti-web

Per rimuoverne uno:

    flyctl secrets unset NOME -a musica-eventi-e-documenti-web

**Secrets attuali** (nomi, valori crittografati):
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET`

### Variabili nel fly.toml

Queste sono visibili in chiaro e non critiche:

    [env]
      NODE_ENV = "production"
      PORT = "3000"
      DB_DIALECT = "sqlite"
      DB_STORAGE = "/data/musica_eventi_e_documenti_web.db"

### Volume persistente

    flyctl volumes list -a musica-eventi-e-documenti-web

Il volume `musica_data` (1 GB, regione `fra`) è montato su `/data`.

### Macchina

    flyctl machine status 2873245c4659e8 -a musica-eventi-e-documenti-web

Mostra: RAM, CPU, stato, mounts, ecc.

---

## Comandi di riferimento

### Configurazione iniziale (una volta sola)

    flyctl auth login
    flyctl apps create musica-eventi-e-documenti-web
    flyctl volumes create musica_data --size 1 --region fra -a musica-eventi-e-documenti-web
    flyctl secrets set TURSO_DATABASE_URL="..." TURSO_AUTH_TOKEN="..." JWT_SECRET="..." -a musica-eventi-e-documenti-web

### Operazioni quotidiane

    # Stato
    flyctl status -a musica-eventi-e-documenti-web

    # Log
    flyctl logs -a musica-eventi-e-documenti-web --no-tail

    # Deploy
    cd C:\musica_eventi_e_documenti_web
    flyctl deploy --local-only

    # Sospendi / Riprendi
    flyctl apps suspend musica-eventi-e-documenti-web
    flyctl apps resume musica-eventi-e-documenti-web

### Manutenzione

    # Aggiorna RAM
    flyctl machine update 2873245c4659e8 --vm-memory 512 -a musica-eventi-e-documenti-web

    # Riavvia
    flyctl machine restart 2873245c4659e8 -a musica-eventi-e-documenti-web

    # SSH nel container
    flyctl ssh console -a musica-eventi-e-documenti-web

    # Dashboard web
    flyctl dashboard -a musica-eventi-e-documenti-web

### Pulizia (se serve)

    # Rimuovi l'app interamente (ATTENZIONE: distrugge tutto)
    flyctl apps destroy musica-eventi-e-documenti-web

---

## Note finali

- **ID macchina**: `2873245c4659e8` (cambia se ricrei la macchina)
- **Nome app**: `musica-eventi-e-documenti-web`
- **URL pubblico**: https://musica-eventi-e-documenti-web.fly.dev
- **Regione**: `fra` (Francoforte, EU Central)
- **Volume**: `musica_data` (1 GB)
- **RAM**: 1 GB (`shared-cpu-1x`)
- **Auto-suspend**: attivo (`min_machines_running = 0`)

Per dubbi: consulta i log con `flyctl logs --no-tail` prima di tutto.
