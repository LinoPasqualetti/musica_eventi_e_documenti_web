require('dotenv').config();
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

(async () => {
  try {
    await db.execute('DROP TABLE IF EXISTS documents');
    console.log('✅ documents droppato');
  } catch (e) {
    console.log('❌', e.message);
  }

  const r = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  console.log('Tabelle rimaste:', r.rows.length);
  r.rows.forEach(x => console.log('  -', x.name));

  process.exit(0);
})();