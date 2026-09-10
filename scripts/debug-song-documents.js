
// Diagnostica: per un evento, mostra brano per brano cosa c'è (o non c'è) in
// song_documents / event_song_documents / documents, e cosa restituisce
// davvero la vista v_event_documents. Aiuta a capire se manca il dato o se
// c'è un problema nella query.
//
// Uso:
//   node debug-song-documents.js <event_id>

const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const SOURCE_DB_PATH = process.env.SQLITE_DB_PATH;
const eventId = process.argv[2];

if (!eventId) {
  console.error('Uso: node debug-song-documents.js <event_id>');
  process.exit(1);
}

const db = new sqlite3.Database(SOURCE_DB_PATH, sqlite3.OPEN_READONLY);

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

(async () => {
  try {
    console.log(`📂 DB: ${SOURCE_DB_PATH}`);
    console.log(`🎯 Evento: ${eventId}`);
    console.log('');

    const songs = await all(
      `SELECT es.id AS event_song_id, s.id AS song_id, s.title
       FROM event_songs es JOIN songs s ON es.song_id = s.id
       WHERE es.event_id = ? ORDER BY es.order_index`,
      [eventId]
    );

    for (const song of songs) {
      console.log(`--- #${song.song_id} "${song.title}" (event_song_id=${song.event_song_id}) ---`);

      const globalDocs = await all(
        `SELECT sd.document_id, d.file_name, d.doc_type
         FROM song_documents sd LEFT JOIN documents d ON sd.document_id = d.id
         WHERE sd.song_id = ?`,
        [song.song_id]
      );
      console.log(`  song_documents (globali): ${globalDocs.length}`,
        globalDocs.map(d => `${d.file_name || '??'} [doc_id=${d.document_id}]`));

      const specificDocs = await all(
        `SELECT esd.document_id, d.file_name, d.doc_type
         FROM event_song_documents esd LEFT JOIN documents d ON esd.document_id = d.id
         WHERE esd.event_song_id = ?`,
        [song.event_song_id]
      );
      console.log(`  event_song_documents (specifici): ${specificDocs.length}`,
        specificDocs.map(d => `${d.file_name || '??'} [doc_id=${d.document_id}]`));

      const viewRows = await all(
        `SELECT document_id, document_name, document_source
         FROM v_event_documents WHERE event_id = ? AND song_id = ?`,
        [eventId, song.song_id]
      );
      console.log(`  v_event_documents restituisce: ${viewRows.length}`,
        viewRows.map(d => `${d.document_name} (${d.document_source})`));
      console.log('');
    }

    db.close();
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
})();























































