// [MODIFICA] C:\musica_eventi_e_documenti_web\scripts\sync-incremental.js

const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Carica le variabili d'ambiente dal backend.
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

// Allinea lo schema della tabella copia a quello del sorgente
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
    // NOTA: 'users' e 'registrations' sono state rimosse.
    // Sono tabelle BIDIREZIONALI.
    const tables = [
      // 'users',            // rimossa - bidirezionale
      'songs',
      'events',
      'documents',
      'event_songs',
      'song_documents',
      'event_song_documents',
      // 'registrations',    // rimossa - bidirezionale
      'event_assignments',
      'instrument_parts',
      'musical_documents',
      'song_infos'
    ];

    let totalRecords = 0;
    const tableErrors = [];

    for (const tableName of tables) {
      console.log(`🔄 Sincronizzazione: ${tableName}`);

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
          // La tabella esiste già: allinea lo schema
          await reconcileSchema(sourceDb, targetDb, tableName);
        }

        // Se la copia è vuota per questa tabella, sincronizziamo tutto lo storico.
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

        // Leggi i dati dal sorgente
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

        // Ottieni le colonne della tabella
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

          // Tabelle con UNIQUE(composite): cancella prima l'eventuale riga
          // con la stessa coppia di FK (id diverso).
          const compositeKeyMap = {
            'song_documents': ['document_id', 'song_id'],
            'event_songs': ['event_id', 'song_id'],
            'event_song_documents': ['event_song_id', 'document_id']
          };

          if (compositeKeyMap[tableName]) {
            const keys = compositeKeyMap[tableName];
            const whereClause = keys.map(k => `${k} = ?`).join(' AND ');
            const whereValues = keys.map(k => row[k]);

            await new Promise((resolve, reject) => {
              targetDb.run(
                `DELETE FROM ${tableName} WHERE ${whereClause}`,
                whereValues,
                (err) => err ? reject(err) : resolve()
              );
            });
          }

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

    // ============================================================
    // FASE DI PULIZIA: cancella dal DB web i record rimossi dal desktop
    // ============================================================
    // Solo per tabelle "desktop-first". NON tocca tabelle bidirezionali
    // (registrations, users) né tabelle web-first (user_feedback, ecc.).
    //
    // Ordine di cancellazione (dipendenze):
    // 1. Tabelle di associazione (contengono FK verso le principali)
    // 2. Tabelle principali
    console.log('');
    console.log('🧹 FASE DI PULIZIA (cancellazione record orfani)...');

    const cleanupTables = [
      { table: 'event_song_documents', keyColumn: 'id' },
      { table: 'song_documents', keyColumn: 'id' },
      { table: 'event_songs', keyColumn: 'id' },
      { table: 'event_assignments', keyColumn: 'id' },
      { table: 'instrument_parts', keyColumn: 'id' },
      { table: 'musical_documents', keyColumn: 'id' },
      { table: 'song_infos', keyColumn: 'id' },
      { table: 'documents', keyColumn: 'id' },
      { table: 'events', keyColumn: 'id' },
      { table: 'songs', keyColumn: 'id' },
    ];

    let totalDeleted = 0;

    for (const { table, keyColumn } of cleanupTables) {
      try {
        // 1. Verifica che la tabella esista nel DB web
        const tableExists = await new Promise((resolve, reject) => {
          targetDb.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            [table],
            (err, row) => err ? reject(err) : resolve(!!row)
          );
        });

        if (!tableExists) {
          continue;
        }

        // 2. Prendi tutti gli id presenti nel DB desktop
        const sourceIds = await new Promise((resolve, reject) => {
          sourceDb.all(`SELECT ${keyColumn} FROM ${table}`, (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(r => r[keyColumn]));
          });
        });

        // 3. Prendi tutti gli id presenti nel DB web
        const targetIds = await new Promise((resolve, reject) => {
          targetDb.all(`SELECT ${keyColumn} FROM ${table}`, (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(r => r[keyColumn]));
          });
        });

        // 4. Trova gli id presenti nel web ma non nel desktop (orfani)
        const sourceSet = new Set(sourceIds);
        const orphans = targetIds.filter(id => !sourceSet.has(id));

        if (orphans.length === 0) {
          console.log(`   ✅ ${table}: nessun orfano`);
          continue;
        }

        // 5. Cancella gli orfani
        const placeholders = orphans.map(() => '?').join(', ');
        const deleteResult = await new Promise((resolve, reject) => {
          targetDb.run(
            `DELETE FROM ${table} WHERE ${keyColumn} IN (${placeholders})`,
            orphans,
            function(err) {
              if (err) return reject(err);
              resolve(this.changes);
            }
          );
        });

        totalDeleted += deleteResult;
        console.log(`   🗑️  ${table}: ${deleteResult} record orfani cancellati`);
      } catch (cleanupError) {
        console.error(`   ❌ Errore pulizia ${table}: ${cleanupError.message}`);
        tableErrors.push({ tableName: `cleanup ${table}`, message: cleanupError.message });
      }
    }

    if (totalDeleted > 0) {
      console.log(`🧹 Pulizia completata: ${totalDeleted} record orfani rimossi`);
    } else {
      console.log('🧹 Pulizia completata: nessun orfano trovato');
    }

    // Sincronizza le VISTE
    console.log('');
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

    // Salva il timestamp SOLO se non ci sono stati errori.
    console.log('');
    if (tableErrors.length === 0) {
      const newTimestamp = new Date().toISOString();
      saveLastSyncTime(newTimestamp);
      console.log(`📅 Nuovo timestamp: ${newTimestamp}`);
    } else {
      console.log('⚠️  lastSync NON aggiornato: i record falliti verranno ritentati');
    }

    // Riepilogo finale
    console.log('');
    console.log('✅ SINCRONIZZAZIONE COMPLETATA!');
    if (tableErrors.length > 0) {
      console.log('');
      console.log(`⚠️  ATTENZIONE: ${tableErrors.length} tabella/e con errori (vedi sopra):`);
      tableErrors.forEach(e => console.log(`   - ${e.tableName}: ${e.message}`));
    }
    console.log(`📊 Record aggiornati: ${totalRecords}`);
    console.log(`🗑️  Record cancellati: ${totalDeleted}`);
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