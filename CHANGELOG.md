# Changelog — Musica Eventi e Documenti Web

Diario delle modifiche al progetto, in ordine cronologico inverso (più recenti in alto).

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

---

## [2026-09-13] — Deploy completo del frontend + documentazione

### Aggiunto
- **Frontend React deployato su Fly.io** insieme al backend
- Frontend servito come file statici dal backend Express (stessa origine, no CORS)
- SPA fallback per React Router (route lato client)
- `Dockerfile` multi-stage alla radice del progetto
- `.dockerignore` alla radice (esclude node_modules, DB locale, docx, ecc.)
- `README.md` con panoramica architettura
- `DEPLOY.md` con guida operativa completa
- `CHANGELOG.md` (questo file)

### Modificato
- `backend/src/index.js`: aggiunto `express.static` per servire `frontend/dist`
- `backend/src/index.js`: aggiunta route SPA fallback `app.get(/^\/(?!api|uploads).*/)`
- `backend/src/config/logger.js`: console transport sempre attivo (anche in produzione)
- `frontend/src/services/api.js`: `API_URL` da `http://localhost:5000/api` → `/api`
- `frontend/src/components/DocumentViewer.jsx`: stesso cambiamento
- `frontend/src/pages/EventSongDocuments.jsx`: stesso cambiamento
- `fly.toml` spostato dalla cartella `backend/` alla radice
- `Dockerfile` spostato dalla cartella `backend/` alla radice

### Note tecniche
- Il `Dockerfile` ora copia sia `backend/` che `frontend/dist/` nell'immagine
- Il deploy va fatto dalla radice (`C:\musica_eventi_e_documenti_web`)
- Il frontend deve essere buildato (`npm run build`) prima di ogni deploy

---

## [2026-09-12] — Deploy del backend su Fly.io + fix critici

### Aggiunto
- Backend Express deployato su Fly.io (regione `fra`)
- Volume persistente `musica_data` (1 GB) montato su `/data`
- App `musica-eventi-e-documenti-web` creata su Fly.io
- Secrets configurati su Fly:
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
  - `JWT_SECRET`
- DB SQLite copiato dal PC al volume Fly (12 MB, 11 eventi, 51 brani)

### Modificato
- `fly.toml` creato con:
  - `auto_stop_machines = "suspend"` (risparmio crediti)
  - `min_machines_running = 0`
  - `memory = "1024mb"` (aumentata da 512 MB per evitare OOM)
- `Dockerfile` creato (era assente)
- `.dockerignore` creato
- `backend/src/config/logger.js`: fix del transport console in produzione

### Fixati
- **OOM killer**: Node veniva ucciso per esaurimento RAM a 256 MB e 512 MB
  - Soluzione: RAM portata a 1 GB
- **Logger silenzioso in produzione**: `winston` scriveva solo su file, non su console
  - Soluzione: console transport sempre attivo
- **`database.js` non aveva ramo Turso**: in produzione falliva la connessione
  - Soluzione: la produzione usa SQLite locale su volume Fly (Turso resta mirror per dev)

### Note tecniche
- Tentativo fallito con `@nxtmd/turso` (incompatibile con Sequelize v6, richiede v7 alpha)
- Tentativo fallito con `cloudflare2sequelize` (pacchetto abbandonato)
- Alla fine: la produzione usa SQLite locale su volume, non Turso diretto

---

## [2026-09-11] — Analisi del progetto e primi test

### Aggiunto
- Script `analisi_web.ps1` (analisi struttura progetto web)
- Report `analisi_web.txt` generato

### Modificato
- Prima esplorazione del setup di pubblicazione
- Identificato Turso come DB cloud per backup

### Note tecniche
- Il DB contiene 11 eventi, 51 brani, 49 documenti
- I documenti sono in due modalità: `blob` (33 con contenuto) e `filesystem` (8 con path a file locali)

---

## [date precedenti] — Sviluppo iniziale

### Contesto
- App desktop **Flutter/Dart** per la gestione di eventi musicali (`C:\musica_eventi_e_documenti`)
- Backend **Node.js/Express** per la versione web
- Frontend **React/Vite** per l'interfaccia web
- DB **SQLite** locale

### Componenti create
- Backend Express con:
  - Route API per eventi, brani, documenti
  - Autenticazione JWT
  - Upload file con multer
  - Logging con winston
  - Middleware: correlationId, performance, errorHandler
- Frontend React con:
  - Pagine: EventList, EventDetail, EventSetlist, EventSongDocuments, EventSongsAssignment
  - Componenti: AbcViewer, MidiPlayer, MxlViewer, ScoreViewer, DocumentViewer
  - Servizi: api.js (Axios), mxlToAbc.js
- DB SQLite con schema completo:
  - Tabelle: events, songs, documents, song_documents, event_song_documents, users, ecc.
  - Viste: v_song_documents, v_event_documents, ecc.

---

## Legenda tipi di modifica

- **Aggiunto** — nuove funzionalità
- **Modificato** — modifiche a funzionalità esistenti
- **Deprecato** — funzionalità che verranno rimosse
- **Rimosso** — funzionalità rimosse
- **Fixato** — bug corretti
- **Sicurezza** — vulnerabilità corrette
- **Note tecniche** — dettagli utili per il futuro

---

## Come aggiornare questo file

Quando fai una modifica significativa al progetto:

1. Aggiungi una nuova sezione in cima (dopo `---`)
2. Usa il formato:

       ## [YYYY-MM-DD] — Titolo breve

       ### Aggiunto / Modificato / Fixato / Rimosso
       - Descrizione della modifica
       - Altre modifiche correlate

       ### Note tecniche
       - Dettagli su come funziona, problemi incontrati, soluzioni

3. Non cancellare le sezioni precedenti (servono come storico)
