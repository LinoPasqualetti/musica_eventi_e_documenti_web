// Copia completa e atomica del database sorgente (quello dell'app Flutter)
// verso la copia usata dal web server — sostituisce sync-incremental.js.
//
// Usa VACUUM INTO invece di una semplice copia di file: è un comando SQLite
// che produce una copia consistente anche se il database sorgente è aperto
// in scrittura da un'altra applicazione nello stesso momento (l'app
// Flutter), a differenza di un fs.copyFile che potrebbe catturare uno stato
// a metà scrittura.
//
// Uso:
//   node full-copy.js

const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../backend/.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error(`⚠️  Impossibile caricare il file .env da: ${envPath}`);
  console.error(`   Dettaglio: ${envResult.error.message}`);
} else {
  console.log(`✅ File .env caricato da: ${envPath}`);
}

const SOURCE_DB_PATH = process.env.SQLITE_DB_PATH ||
  'C:/Users/LINOP/Documents/musica_eventi_e_documenti.db';

const TARGET_DB_PATH = path.resolve(__dirname, '../backend',
  process.env.DB_STORAGE || './data/musica_eventi_e_documenti_web.db');

console.log(`📂 Database sorgente: ${SOURCE_DB_PATH}`);
console.log(`📂 Database copia: ${TARGET_DB_PATH}`);

if (!fs.existsSync(SOURCE_DB_PATH)) {
  console.error(`❌ ERRORE: File database sorgente non trovato in ${SOURCE_DB_PATH}`);
  if (SOURCE_DB_PATH.includes('TUO_NOME_UTENTE')) {
    console.error('   Questo è il percorso di DEFAULT (segnaposto): SQLITE_DB_PATH');
    console.error('   non è stato letto correttamente da backend/.env.');
  }
  process.exit(1);
}

const targetDir = path.dirname(TARGET_DB_PATH);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Un'eventuale copia precedente va rimossa prima: VACUUM INTO richiede che
// il file di destinazione non esista già.
if (fs.existsSync(TARGET_DB_PATH)) {
  const backupPath = TARGET_DB_PATH + '.bak';
  fs.copyFileSync(TARGET_DB_PATH, backupPath);
  fs.unlinkSync(TARGET_DB_PATH);
  console.log(`ℹ️  Copia precedente salvata come backup: ${backupPath}`);
}

const sourceDb = new sqlite3.Database(SOURCE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Impossibile aprire il database sorgente:', err.message);
    process.exit(1);
  }
});

console.log('');
console.log('🚀 Copia in corso (VACUUM INTO)...');

// path per VACUUM INTO va scritto con gli apici singoli SQL, non doppi
// (le doppie sono riservate agli identificatori in SQLite — stesso errore
// già incontrato altrove in questo progetto).
const escapedTargetPath = TARGET_DB_PATH.replace(/'/g, "''");

sourceDb.exec(`VACUUM INTO '${escapedTargetPath}'`, (err) => {
  sourceDb.close();

  if (err) {
    console.error('❌ Errore durante la copia:', err.message);
    process.exit(1);
  }

  const stats = fs.statSync(TARGET_DB_PATH);
  console.log(`✅ COPIA COMPLETATA! (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`📂 Database copia: ${TARGET_DB_PATH}`);
  console.log('');
  console.log('ℹ️  Riavvia il backend (npm run dev) per usare i dati aggiornati.');
});
