require('dotenv').config();
const { createClient } = require('@libsql/client');

async function test() {
  console.log('🔍 Test connessione Turso...\n');

  if (!process.env.TURSO_DATABASE_URL) {
    console.error('❌ TURSO_DATABASE_URL mancante nel .env');
    process.exit(1);
  }
  if (!process.env.TURSO_AUTH_TOKEN) {
    console.error('❌ TURSO_AUTH_TOKEN mancante nel .env');
    process.exit(1);
  }

  console.log('📡 URL:', process.env.TURSO_DATABASE_URL);
  console.log('🔑 Token:', process.env.TURSO_AUTH_TOKEN.substring(0, 20) + '...\n');

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const v = await db.execute('SELECT 1 + 1 AS risultato');
    console.log('✅ Connessione OK! Test query:', v.rows[0]);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS _test_connection (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        messaggio TEXT,
        creato_il DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabella _test_connection creata');

    const ins = await db.execute({
      sql: 'INSERT INTO _test_connection (messaggio) VALUES (?)',
      args: ['Ciao da ' + new Date().toISOString()],
    });
    console.log('✅ Insert OK, id =', Number(ins.lastInsertRowid));

    const rows = await db.execute('SELECT * FROM _test_connection ORDER BY id DESC LIMIT 5');
    console.log('\n📋 Ultime righe:');
    rows.rows.forEach(r => console.log('  ', r));

    await db.execute('DROP TABLE _test_connection');
    console.log('\n🧹 Tabella di test eliminata');

    console.log('\n🎉 TUTTO OK! Turso è raggiungibile e scrivibile.\n');
  } catch (err) {
    console.error('\n❌ ERRORE:', err.message);
    console.error(err);
    process.exit(1);
  }
}

test();