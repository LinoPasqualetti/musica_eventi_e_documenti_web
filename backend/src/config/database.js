/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\config\database.js
 *
 * 📝 DESCRIZIONE: Configurazione del database Sequelize
 * - Supporta SQLite (default) e PostgreSQL
 * - Logging delle query con tempo di esecuzione
 * - Configurazione pool di connessioni
 * - Test di connessione all'avvio
 */

const { Sequelize } = require('sequelize');
const logger = require('./logger');
const { dbQueryLogger } = require('../middleware/performance');

// Determina il database da usare
const isSQLite = process.env.DB_DIALECT === 'sqlite' || !process.env.DB_DIALECT;

let sequelize;

if (isSQLite) {
  // Configurazione SQLite
  const dbPath = process.env.DB_STORAGE || './data/musica_eventi_e_documenti_web.db';

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: (msg, options) => {
      // Usa il logger di performance per le query
      dbQueryLogger(msg, options);
      // Log di debug per tutte le query (in sviluppo)
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`SQL: ${msg}`);
      }
    },
    // Configurazione del pool (solo per SQLite è meno rilevante)
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    // Timeout per le query
    query: {
      timeout: 5000 // 5 secondi
    }
  });
} else {
  // Configurazione PostgreSQL
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: (msg, options) => {
        dbQueryLogger(msg, options);
        if (process.env.NODE_ENV !== 'production') {
          logger.debug(`SQL: ${msg}`);
        }
      },
      pool: {
        max: parseInt(process.env.DB_POOL_MAX) || 5,
        min: parseInt(process.env.DB_POOL_MIN) || 0,
        acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
        idle: parseInt(process.env.DB_POOL_IDLE) || 10000
      },
      query: {
        timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 5000
      }
    }
  );
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
  isSQLite
};