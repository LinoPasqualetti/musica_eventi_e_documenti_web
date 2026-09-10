const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Carica le variabili d'ambiente dal backend. Percorso ASSOLUTO rispetto a
// questo file (non alla cartella da cui lanci il comando): con un percorso
// relativo tipo '../backend/.env', se lo script viene eseguito da una
// cartella diversa da scripts/ il file .env non viene trovato e si cade
// silenziosamente sui valori di default — incluso il segnaposto
// 'TUO_NOME_UTENTE' che non esiste su nessuna macchina reale.
const envPath = path.resolve(__dirname, '../backend/.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error(`⚠️  Impossibile caricare il file .env da: ${envPath}`);
  console.error(`   Dettaglio: ${envResult.error.message}`);
  console.error(`   Verrà usato il percorso di default (probabilmente sbagliato).`);
} else {
  console.log(`✅ File .env caricato da: ${envPath}`);
}

// PERCORSO DEL DATABASE SORGENTE OPERATIVO (in Documenti)
const SOURCE_DB_PATH = process.env.SQLITE_DB_PATH ||
  'C:/Users/TUO_NOME_UTENTE/Documents/musica_eventi_e_documenti.db';

// PERCORSO DEL DATABASE COPIA (per il web)
const TARGET_DB_PATH = path.resolve(__dirname, '../backend',
  process.env.DB_STORAGE || './data/musica_eventi_e_documenti_web.db');

const LAST_SYNC_FILE = path.join(__dirname, 'last_sync.json');

console.log(`📂 Database sorgente: ${SOURCE_DB_PATH}`);
console.log(`📂 Database copia: ${TARGET_DB_PATH}`);

// Verifica che il file sorgente esista
if (!fs.existsSync(SOURCE_DB_PATH)) {
  console.error(`❌ ERRORE: File database sorgente non trovato in ${SOURCE_DB_PATH}`);
  if (SOURCE_DB_PATH.includes('TUO_NOME_UTENTE')) {
    console.error('   Questo è il percorso di DEFAULT (segnaposto): significa che');
    console.error('   SQLITE_DB_PATH non è stato letto da backend/.env. Controlla');
    console.error('   il messaggio "File .env caricato da: ..." qui sopra.');
  } else {
    console.log('   Verifica il percorso nel file .env (SQLITE_DB_PATH)');
  }
  process.exit(1);
}

// Verifica che la cartella di destinazione esista
const targetDir = path.dirname(TARGET_DB_PATH);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Carica l'ultimo timestamp di sincronizzazione
function getLastSyncTime() {
  try {
    if (fs.existsSync(LAST_SYNC_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAST_SYNC_FILE, 'utf8'));
      return data.lastSync;
    }
  } catch (error) {
    console.warn('⚠️ Impossibile leggere last_sync.json, uso data di default');
  }
  return '2024-01-01 00:00:00';
}

function saveLastSyncTime(timestamp) {
  fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({ lastSync: timestamp }, null, 2));
}

// Allinea lo schema della tabella copia a quello del sorgente: aggiunge le
// colonne mancanti (es. storage_mode/content/mime_type appena introdotte su
// documents). Prima d'ora la sincronizzazione clonava lo schema SOLO se la
// tabella non esisteva affatto nella copia, quindi una tabella già presente
// da sync precedenti non riceveva mai le nuove colonne — e la INSERT
// dinamica su quelle colonne avrebbe fallito con "no such column".
async function reconcileSchema(sourceDb, targetDb, tableName) {
  const sourceColumns = await new Promise((resolve, reject) => {
    sourceDb.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const targetColumns = await new Promise((resolve, reject) => {
    targetDb.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const targetColumnNames = new Set(targetColumns.map(c => c.name));
  const missingColumns = sourceColumns.filter(c => !targetColumnNames.has(c.name));

  for (const col of missingColumns) {
    console.log(`   🔧 Aggiungo colonna mancante ${tableName}.${col.name} (${col.type})`);
    await new Promise((resolve, reject) => {
      targetDb.run(
        `ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

async function syncTables() {
  const lastSync = getLastSyncTime();

  console.log('');
  console.log('🚀 AVVIO SINCRONIZZAZIONE INCREMENTALE');
  console.log(`📅 Ultima sincronizzazione: ${lastSync}`);
  console.log('');

  // Connessione al database sorgente
  const sourceDb = new sqlite3.Database(SOURCE_DB_PATH);

  // Connessione al database copia (crea il file se non esiste)
  const targetDb = new sqlite3.Database(TARGET_DB_PATH);

  try {
    // Lista delle tabelle da sincronizzare
    const tables = [
      'users',
      'songs',
      'events',
      'documents',
      'event_songs',
      'song_documents',
      'event_song_documents',
      'registrations',
      'event_assignments',
      'instrument_parts',
      'musical_documents',
      'song_infos'
    ];

    let totalRecords = 0;

    const tableErrors = [];

    for (const tableName of tables) {
      console.log(`🔄 Sincronizzazione: ${tableName}`);

      // Ogni tabella è isolata: se una fallisce (es. una colonna con un tipo
      // inatteso, un vincolo che non torna), le altre vengono comunque
      // processate invece che interrompere l'intero script a metà — prima
      // un errore su una tabella qualsiasi bloccava silenziosamente anche
      // tutte quelle successive nell'elenco.
      try {
        // Prima controlla se la tabella esiste nel database copia
        const tableExists = await new Promise((resolve, reject) => {
          targetDb.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            [tableName],
            (err, row) => {
              if (err) return reject(err);
              resolve(!!row);
            }
          );
        });

        if (!tableExists) {
          // Crea la tabella se non esiste (copia lo schema dal sorgente)
          console.log(`   📋 Creazione tabella ${tableName}...`);
          await new Promise((resolve, reject) => {
            sourceDb.get(
              `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`,
              [tableName],
              (err, row) => {
                if (err) return reject(err);
                if (row && row.sql) {
                  targetDb.exec(row.sql, (err) => {
                    if (err) return reject(err);
                    resolve();
                  });
                } else {
                  resolve();
                }
              }
            );
          });
        } else {
          // La tabella esiste già: allinea lo schema aggiungendo le colonne
          // eventualmente comparse nel sorgente da quando fu creata qui.
          await reconcileSchema(sourceDb, targetDb, tableName);
        }

        // Se la copia è vuota per questa tabella (appena creata, svuotata,
        // o un sync precedente interrotto prima di arrivarci), il filtro
        // incrementale lascerebbe fuori tutto lo storico: last_sync.json
        // continua a riportare la data dell'ultima sincronizzazione
        // riuscita, indipendentemente da quanti dati sono davvero rimasti
        // sulla copia. In quel caso sincronizziamo tutti i record, non solo
        // quelli più recenti di lastSync.
        const targetRowCount = await new Promise((resolve, reject) => {
          targetDb.get(`SELECT COUNT(*) AS c FROM ${tableName}`, (err, row) => {
            if (err) return reject(err);
            resolve(row ? row.c : 0);
          });
        });
        const needsFullSync = targetRowCount === 0;
        if (needsFullSync) {
          console.log(`   ℹ️  Copia vuota per questa tabella: sincronizzo tutto lo storico`);
        }

        // Leggi i dati dal sorgente: tutto lo storico se la copia è vuota,
        // altrimenti solo le modifiche più recenti dell'ultima sincronizzazione.
        const sourceData = await new Promise((resolve, reject) => {
          if (needsFullSync) {
            sourceDb.all(`SELECT * FROM ${tableName}`, (err, rows) => {
              if (err) return reject(err);
              resolve(rows);
            });
          } else {
            sourceDb.all(
              `SELECT * FROM ${tableName}
               WHERE updated_at > ? OR (updated_at IS NULL AND created_at > ?)`,
              [lastSync, lastSync],
              (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
              }
            );
          }
        });

        if (sourceData.length === 0) {
          console.log(`   ✅ Nessuna modifica`);
          continue;
        }

        console.log(`   📝 ${sourceData.length} record da sincronizzare`);

        // Ottieni le colonne della tabella (ora sicuramente allineate)
        const columns = await new Promise((resolve, reject) => {
          sourceDb.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(r => r.name));
          });
        });

        // Sincronizza i dati
        for (const row of sourceData) {
          const placeholders = columns.map(() => '?').join(', ');
          const updateClause = columns
            .filter(col => col !== 'id')
            .map(col => `${col} = ?`)
            .join(', ');

          const values = columns.map(col => row[col]);
          const updateValues = columns
            .filter(col => col !== 'id')
            .map(col => row[col]);

          const query = `
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT(id) DO UPDATE SET ${updateClause}
          `;

          await new Promise((resolve, reject) => {
            targetDb.run(query, [...values, ...updateValues], (err) => {
              if (err) return reject(err);
              resolve();
            });
          });
        }

        totalRecords += sourceData.length;
        console.log(`   ✅ Sincronizzati ${sourceData.length} record`);
      } catch (tableError) {
        console.error(`   ❌ Errore su ${tableName}: ${tableError.message}`);
        tableErrors.push({ tableName, message: tableError.message });
        console.log(`   ⏭️  Proseguo con la tabella successiva...`);
      }
    }

    // Sincronizza anche le VISTE (v_event_full, v_event_songs,
    // v_event_documents, ecc.): finora venivano sincronizzate solo le
    // tabelle, mai le viste — su una copia web creata/aggiornata da questo
    // script le viste non sono mai esistite, causando "no such table:
    // v_event_full" (SQLite tratta le viste mancanti con lo stesso errore
    // delle tabelle mancanti). Le ricreiamo sempre (DROP + CREATE) per
    // restare allineati a qualunque modifica alla loro definizione.
    console.log('🔄 Sincronizzazione viste...');
    const sourceViews = await new Promise((resolve, reject) => {
      sourceDb.all(`SELECT name, sql FROM sqlite_master WHERE type='view'`, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    for (const view of sourceViews) {
      try {
        await new Promise((resolve, reject) => {
          targetDb.run(`DROP VIEW IF EXISTS ${view.name}`, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
        await new Promise((resolve, reject) => {
          targetDb.exec(view.sql, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
        console.log(`   ✅ Vista ${view.name} aggiornata`);
      } catch (viewError) {
        console.error(`   ❌ Errore su vista ${view.name}: ${viewError.message}`);
        tableErrors.push({ tableName: `vista ${view.name}`, message: viewError.message });
      }
    }

    // Salva il timestamp
    const newTimestamp = new Date().toISOString();
    saveLastSyncTime(newTimestamp);

    console.log('');
    console.log('✅ SINCRONIZZAZIONE COMPLETATA!');
    if (tableErrors.length > 0) {
      console.log('');
      console.log(`⚠️  ATTENZIONE: ${tableErrors.length} tabella/e con errori (vedi sopra):`);
      tableErrors.forEach(e => console.log(`   - ${e.tableName}: ${e.message}`));
    }
    console.log(`📊 Record aggiornati: ${totalRecords}`);
    console.log(`📅 Nuovo timestamp: ${newTimestamp}`);
    console.log('');
    console.log(`📂 Database copia: ${TARGET_DB_PATH}`);

  } catch (error) {
    console.error('❌ Errore durante la sincronizzazione:', error);
  } finally {
    sourceDb.close();
    targetDb.close();
  }
}

// Esegui
syncTables();
