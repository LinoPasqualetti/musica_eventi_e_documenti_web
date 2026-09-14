require('dotenv').config();
const { createClient } = require('@libsql/client');
const TursoSequelize = require('@nxtmd/turso');

async function test() {
  console.log('--- Test @nxtmd/turso ---');
  console.log('Tipo export:', typeof TursoSequelize);
  console.log('Chiavi:', Object.keys(TursoSequelize || {}));

  try {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.log('[OK] Client libsql creato');

    let sequelize;
    try {
      sequelize = new TursoSequelize({ client });
      console.log('[OK] new TursoSequelize({ client })');
    } catch (e) {
      console.log('[WARN] new TursoSequelize({ client }) fallito:', e.message);
      try {
        sequelize = new TursoSequelize(client);
        console.log('[OK] new TursoSequelize(client)');
      } catch (e2) {
        console.log('[ERRORE] new TursoSequelize(client) fallito:', e2.message);
        process.exit(1);
      }
    }

    await sequelize.authenticate();
    console.log('[OK] sequelize.authenticate()');

    const [tables] = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' LIMIT 10"
    );
    console.log('[OK] Query Sequelize. Tabelle:');
    tables.forEach(t => console.log('   -', t.name));
    process.exit(0);
  } catch (err) {
    console.error('[ERRORE]', err.message);
    console.error('   Stack:', err.stack);
    process.exit(1);
  }
}
test();
