# Musica Eventi e Documenti — Web

Applicazione web per la visualizzazione di eventi musicali, la fruizione di documenti
(spartiti, file MIDI/KAR, PDF) e la gestione delle prenotazioni ai brani in scaletta.

## URL pubblico

**Produzione:** https://musica-eventi-e-documenti-web.fly.dev

## Architettura

Il progetto è composto da tre parti:

| Componente | Tecnologia | Ruolo |
|---|---|---|
| Frontend | React 19 + Vite + MUI | Interfaccia utente |
| Backend | Node.js + Express + Sequelize | API REST |
| Database | SQLite (su volume Fly) + Turso (backup) | Persistenza dati |

L'app desktop **Flutter/Dart** (in `C:\musica_eventi_e_documenti`) è il sistema di gestione
principale: produce il DB e i documenti che il backend web serve.

## Stack tecnologico dettagliato

### Frontend
- React 19, React Router 7
- MUI (Material UI) 9
- Vite 8 (build tool)
- Axios (chiamate API)
- Librerie musicali: abcjs, @tonejs/midi, opensheetmusicdisplay, musicxml-io
- React Query (state management)

### Backend
- Node.js 20
- Express 4
- Sequelize 6 (ORM su SQLite)
- Multer (upload file)
- Winston (logging)
- Helmet, CORS, Rate Limit (sicurezza)
- JWT (autenticazione)
- Sharp (elaborazione immagini)

### Database
- SQLite locale (`backend/data/musica_eventi_e_documenti_web.db`)
- Turso Cloud (mirror/backup)
- Volume persistente Fly (`/data`, 1 GB)

### Hosting
- **Fly.io** (regione `fra` - Francoforte)
- Macchina: `shared-cpu-1x` con 1 GB RAM
- Auto-suspend attivo (si spegne quando inattiva)

## Struttura del progetto

    musica_eventi_e_documenti_web/
    ├── Dockerfile              # Build multi-stage (backend + frontend)
    ├── fly.toml                # Configurazione Fly.io
    ├── .dockerignore           # File esclusi dal build
    ├── backend/                # Backend Node.js/Express
    │   ├── src/                # Sorgenti
    │   ├── data/               # DB SQLite locale (sviluppo)
    │   ├── uploads/            # File caricati (immagini, PDF, ecc.)
    │   └── package.json
    ├── frontend/               # Frontend React/Vite
    │   ├── src/                # Sorgenti
    │   ├── dist/               # Build di produzione (generata da npm run build)
    │   └── package.json
    └── scripts/                # Script di sincronizzazione e utility

## Flusso dei dati

    App desktop Flutter
        ↓ (sincronizzazione)
    DB SQLite + Turso
        ↓ (copia manuale al primo deploy)
    Backend Fly.io (DB su volume /data)
        ↓ (API REST)
    Frontend React (browser utente)

## Comandi principali

Vedi `DEPLOY.md` per la guida operativa completa.

### Avvio in locale
    # Backend
    cd backend
    npm start

    # Frontend (in un secondo terminale)
    cd frontend
    npm run dev

### Deploy in produzione
    # Dalla radice del progetto
    flyctl deploy --local-only

### Stato dell'app
    flyctl status -a musica-eventi-e-documenti-web
    flyctl logs -a musica-eventi-e-documenti-web --no-tail

## Note importanti

- **Il DB di produzione è una copia manuale** del DB locale, caricata sul volume Fly al primo deploy.
  Per aggiornarlo: vedi `DEPLOY.md`.
- **Il frontend deve essere buildato prima del deploy**: `cd frontend && npm run build`.
- **I file `filesystem` con path Windows** (es. `C:\...`) non funzionano su Fly.
  Solo i documenti in `storage_mode='blob'` sono serviti correttamente.
- **Il trial Fly.io** dura 7 giorni o 2 ore di utilizzo. Alla scadenza, la macchina viene sospesa.
  Vedi `DEPLOY.md` per la gestione post-trial.

## Contatti

Progetto personale di Lino Pasqualetti.
Email: linopasqualetti@libero.it
