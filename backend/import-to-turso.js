/**
 * Import del dump SQL locale su Turso Cloud - VERSIONE ROBUSTA
 * Gestisce correttamente BLOB e stringhe con ; e newline
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const DUMP_FILE = path.join(__dirname, 'dump_fixed.sql');

/**
 * Parser SQL robusto:
 * - Ignora il contenuto dentro stringhe '...' (gestendo '' escape)
 * - Ignora il contenuto dentro BLOB X'...'
 * - Divide solo sui ; seguiti da newline FUORI da stringhe
 */
function parseSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let inBlob = false;
  let i = 0;

  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];

    // Rileva inizio/fine stringa '
    if (!inBlob && c === "'") {
      if (inString && next === "'") {
        // Escape ''
        current += "''";
        i += 2;
        continue;
      }
      inString = !inString;
      current += c;
      i++;
      continue;
    }

    // Rileva inizio/fine BLOB X'...'
    if (!inString && (c === 'X' || c === 'x') && next === "'") {
      inBlob = true;
      current += "X'";
      i += 2;
      continue;
    }
    if (inBlob && c === "'") {
      inBlob = false;
      current += c;
      i++;
      continue;
    }

    // Fine statement: ; fuori da stringhe e blob
    if (!inString && !inBlob && c === ';') {
      const stmt = current.trim();
      if (stmt && !/^PRAGMA\s+foreign_keys/i.test(stmt) && !/^(BEGIN|COMMIT)/i.test(stmt)) {
        statements.push(stmt);
      }
      current = '';
      i++;
      continue;
    }

    current += c;
    i++;
  }

  // Ultimo statement (se manca ;)
  const last = current.trim();
  if (last && !/^(BEGIN|COMMIT)/i.test(last)) {
    statements.push(last);
  }

  return statements;
}

async function main() {
  console.log('🚀 Import su Turso Cloud (parser robusto)\n');

  if (!fs.existsSync(DUMP_FILE)) {
    console.error(`❌ File non trovato: ${DUMP_FILE}`);
    process.exit(1);
  }
  const dumpSize = fs.statSync(DUMP_FILE).size;
  console.log(`📄 Dump: ${(dumpSize / 1024 / 1024).toFixed(2)} MB\n`);

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Test connessione
  await db.execute('SELECT 1');
  console.log('✅ Connessione a Turso OK\n');

  // ⚠️ Controlla che il DB remoto sia vuoto
  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  if (tables.rows.length > 0) {
    console.log('⚠️ Il DB remoto contiene già tabelle:');
    tables.rows.forEach(t => console.log('   -', t.name));
    console.log('\n❌ Interrompo per evitare conflitti.');
    console.log('   Per svuotare Turso, esegui: node wipe-turso.js');
    console.log('   Oppure crea un nuovo database su https://turso.tech/app');
    process.exit(1);
  }

  // Leggi e parse del dump
  console.log('📖 Lettura dump...');
  const sql = fs.readFileSync(DUMP_FILE, 'utf-8');
  const statements = parseSqlStatements(sql);
  console.log(`🔧 ${statements.length} statement trovati\n`);

  // Esegui
  let ok = 0, ko = 0;
  const errors = [];
  const startTime = Date.now();

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await db.execute(stmt);
      ok++;
    } catch (err) {
      ko++;
      const preview = stmt.substring(0, 120).replace(/\s+/g, ' ');
      errors.push({ index: i, stmt: preview, error: err.message });
      if (errors.length <= 10) {
        console.error(`❌ [${i + 1}] ${err.message}`);
        console.error(`   → ${preview}...`);
      }
    }

    if ((i + 1) % 25 === 0 || i === statements.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = (((i + 1) / statements.length) * 100).toFixed(1);
      console.log(`   [${i + 1}/${statements.length}] ${pct}% — ✅ ${ok} OK, ❌ ${ko} KO — ${elapsed}s`);
    }
  }

  console.log(`\n📊 Risultato: ${ok} OK, ${ko} KO su ${statements.length}`);

  if (errors.length > 0) {
    fs.writeFileSync('import_errors.json', JSON.stringify(errors, null, 2));
    console.log('💾 Errori salvati in import_errors.json');
  }

  // Verifica finale
  console.log('\n📊 Stato finale del DB Turso:');
  const finalTables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  for (const t of finalTables.rows) {
    const c = await db.execute(`SELECT COUNT(*) as n FROM [${t.name}]`);
    console.log(`   ${t.name.padEnd(30)} ${c.rows[0].n} righe`);
  }

  console.log('\n🎉 Import completato!\n');
}

main().catch(err => {
  console.error('💥 Errore fatale:', err);
  process.exit(1);
});