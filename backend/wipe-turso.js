/**
 * Svuota completamente il DB Turso (DROP di tutte le tabelle/viste)
 * ⚠️ ATTENZIONE: distrugge tutti i dati remoti!
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('🧹 Wipe del DB Turso...\n');

  // Disabilita FK
  await db.execute('PRAGMA foreign_keys=OFF');

  // Prendi tutte le tabelle e viste
  const objs = await db.execute(
    "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'"
  );

  for (const o of objs.rows) {
    try {
      await db.execute(`DROP ${o.type.toUpperCase()} IF EXISTS [${o.name}]`);
      console.log(`   ✅ Droppato ${o.type}: ${o.name}`);
    } catch (e) {
      console.log(`   ❌ Errore su ${o.name}: ${e.message}`);
    }
  }

  console.log('\n✅ Wipe completato\n');
}

main().catch(err => {
  console.error('💥 Errore:', err);
  process.exit(1);
});