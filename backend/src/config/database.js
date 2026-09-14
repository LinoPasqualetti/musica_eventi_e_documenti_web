/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\config\database.js
 *
 * 📝 DESCRIZIONE: Configurazione del database Sequelize
 * - Sviluppo: SQLite locale (fonte di verità)
 * - Produzione: Turso Cloud (tramite @nxtmd/turso)
 */

const { Sequelize } = require('sequelize');
const logger = require('./logger');
const { dbQueryLogger } = require('../middleware/performance');

let sequelize;
let isSQLite = false;
let isTurso = false;

// Determina quale database usare
const useTurso = process.env.NODE_ENV === 'production'
              && process.env.TURSO_DATABASE_URL
              && process.env.TURSO_AUTH_TOKEN;

if (useTurso) {
  // PRODUZIONE → Turso Cloud diretto
  try {
    const { createClient } = require('@libsql/client');
    const TursoSequelize = require('@nxtmd/turso');

    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    sequelize = new TursoSequelize({ client });
    isTurso = true;

    logger.info('🌐 Database: Turso Cloud (produzione)');
  } catch (err) {
    logger.error('❌ Errore inizializzazione Turso:', { error: err.message });
    logger.warn('⚠️  Fallback a SQLite locale');
    isTurso = false;
  }
}

if (!isTurso) {
  // SVILUPPO (o fallback) → SQLite locale
  isSQLite = true;
  const dbPath = process.env.DB_STORAGE || './data/musica_eventi_e_documenti_web.db';

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: (msg, options) => {
      dbQueryLogger(msg, options);
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`SQL: ${msg}`);
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    query: {
      timeout: 5000
    }
  });

  logger.info(`💾 Database: SQLite locale (${dbPath})`);
}

// Test della connessione
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully.');
    return true;
  } catch (error) {
    logger.error('❌ Unable to connect to the database:', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  isSQLite,
  isTurso
};