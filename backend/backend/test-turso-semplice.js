// test-turso-semplice.js
require('dotenv').config();

const { createClient } = require('@libsql/client');

async function test() {
  console.log('🔍 Test connessione Turso (client puro)');
  console.log('URL:', process.env.TURSO_DATABASE_URL);
  console.log('Token presente:', !!process.env.TURSO_AUTH_TOKEN);

  try {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.log('✅ Client libsql creato');

    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' LIMIT 10"
    );
    console.log('✅ Query OK. Tabelle trovate:');
    result.rows.forEach(r => console.log('   -', r.name));

    process.exit(0);
  } catch (err) {
    console.error('❌ Errore:', err.message);
    console.error('   Code:', err.code);
    console.error('   Stack:', err.stack);
    process.exit(1);
  }
}

test();