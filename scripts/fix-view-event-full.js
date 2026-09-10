// Corregge la vista v_event_full sul DATABASE SORGENTE (quello dell'app
// Flutter): mancava la colonna image_url, e 'location' non era rinominata
// in 'event_location' come si aspetta eventController.js. Va applicato al
// sorgente (non alla copia web) perché full-copy.js/sync-incremental.js
// sovrascrivono le viste della copia ad ogni esecuzione, prendendole dal
// sorgente — un fix applicato solo lì andrebbe perso al giro successivo.
//
// Uso:
//   node fix-view-event-full.js

const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../backend/.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error(`⚠️  Impossibile caricare il file .env da: ${envPath}`);
  console.error(`   Dettaglio: ${envResult.error.message}`);
} else {
  console.log(`✅ File .env caricato da: ${envPath}`);
}

const SOURCE_DB_PATH = process.env.SQLITE_DB_PATH ||
  'C:/Users/TUO_NOME_UTENTE/Documents/musica_eventi_e_documenti.db';

console.log(`📂 Database sorgente: ${SOURCE_DB_PATH}`);

if (!fs.existsSync(SOURCE_DB_PATH)) {
  console.error(`❌ ERRORE: File database sorgente non trovato in ${SOURCE_DB_PATH}`);
  process.exit(1);
}

const NEW_VIEW_SQL = `
CREATE VIEW v_event_full AS
SELECT
  e.id AS event_id,
  e.title AS event_title,
  e.theme,
  e.description AS event_description,
  e.image_url AS event_image,
  e.date AS event_date,
  e.location AS event_location,
  e.category,
  e.status,
  e.difficulty AS event_difficulty,
  u.full_name AS created_by_name,
  COUNT(DISTINCT es.song_id) AS songs_count,
  COUNT(DISTINCT r.id) AS registrations_count,
  e.created_at,
  e.updated_at
FROM events e
LEFT JOIN users u ON e.created_by = u.id
LEFT JOIN event_songs es ON e.id = es.event_id
LEFT JOIN registrations r ON e.id = r.event_id
GROUP BY e.id
ORDER BY e.date DESC
`;

const db = new sqlite3.Database(SOURCE_DB_PATH, (err) => {
  if (err) {
    console.error('❌ Impossibile aprire il database sorgente:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run('DROP VIEW IF EXISTS v_event_full', (err) => {
    if (err) {
      console.error('❌ Errore durante la rimozione della vista precedente:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('🗑️  Vecchia vista v_event_full rimossa');

    db.run(NEW_VIEW_SQL, (err) => {
      db.close();
      if (err) {
        console.error('❌ Errore durante la creazione della nuova vista:', err.message);
        process.exit(1);
      }
      console.log('✅ Vista v_event_full ricreata con event_image ed event_location corretti');
      console.log('');
      console.log('ℹ️  Ora rilancia full-copy.js (o sync-incremental.js) per');
      console.log('    portare la correzione sulla copia web, poi riavvia il backend.');
    });
  });
});
