const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/musica_eventi_e_documenti_web.db');

console.log('📂 Database path:', dbPath);
console.log('');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
  console.log('✅ Database aperto con successo!\n');
});

// Ottieni tutte le tabelle
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, tables) => {
  if (err) {
    console.error('❌ Errore:', err.message);
    db.close();
    return;
  }

  console.log(`📋 Tabelle trovate: ${tables.length}\n`);

  tables.forEach((table, index) => {
    const tableName = table.name;
    console.log(`📌 TABELLA ${index + 1}: ${tableName}`);
    console.log('═'.repeat(50));

    // Ottieni le colonne
    db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
      if (err) {
        console.error('❌ Errore:', err.message);
        return;
      }

      console.log('Colonne:');
      columns.forEach(col => {
        const pk = col.pk ? '🔑 PK' : '';
        const notnull = col.notnull ? 'NOT NULL' : '';
        const def = col.dflt_value ? `default: ${col.dflt_value}` : '';
        console.log(`  - ${col.name} (${col.type}) ${pk} ${notnull} ${def}`);
      });

      // Ottieni un record di esempio
      db.get(`SELECT * FROM ${tableName} LIMIT 1`, [], (err, row) => {
        if (err) {
          console.error('❌ Errore:', err.message);
          return;
        }

        console.log('\n📝 Record di esempio:');
        if (row) {
          Object.keys(row).forEach(key => {
            const value = row[key];
            const display = value !== null && value !== undefined ? String(value).substring(0, 50) : 'NULL';
            console.log(`  ${key}: ${display}${String(value).length > 50 ? '...' : ''}`);
          });
        } else {
          console.log('  (nessun record trovato)');
        }
        console.log('\n');
      });
    });
  });

  // Chiudi dopo aver finito
  setTimeout(() => {
    db.close(() => {
      console.log('✅ Database chiuso.');
    });
  }, 1000);
});