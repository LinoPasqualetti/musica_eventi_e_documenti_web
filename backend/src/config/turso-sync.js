/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\config\turso-sync.js
 *
 * 📝 DESCRIZIONE: Sincronizzazione embedded replica tra SQLite locale e Turso Cloud
 * - All'avvio: scarica le modifiche remote (pull)
 * - Periodicamente: sync bidirezionale
 * - Alla chiusura: push finale
 *
 * ⚠️ Il DB locale rimane la fonte principale per Sequelize.
 *    Turso Cloud è un "mirror" per backup e accesso remoto.
 */

const path = require('path');
const { createClient } = require('@libsql/client');
const logger = require('./logger');

let tursoClient = null;
let syncTimer = null;
let lastSyncTime = 0;

/**
 * Inizializza la sincronizzazione con Turso Cloud
 * @returns {Promise<boolean>} true se la sync è attiva
 */
async function initTursoSync() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  // Se Turso non è configurato, disabilita silenziosamente
  if (!url || !token) {
    logger.info('ℹ️ Turso non configurato, sync disabilitata (uso solo SQLite locale)');
    return false;
  }

  const dbPath = path.resolve(
    process.env.DB_STORAGE || './data/musica_eventi_e_documenti_web.db'
  );

  try {
    logger.info('🔄 Inizializzazione embedded replica Turso...');
    logger.info(`   URL cloud: ${url}`);
    logger.info(`   File locale: ${dbPath}`);

    // Crea il client con sync URL
    tursoClient = createClient({
      url: `file:${dbPath}`,
      syncUrl: url,
      authToken: token,
      syncInterval: 60, // sync automatica ogni 60s (opzionale, la gestiamo manualmente)
    });

    // Primo sync: pull dal cloud
    const startTime = Date.now();
    await tursoClient.sync();
    const elapsed = Date.now() - startTime;
    lastSyncTime = Date.now();

    logger.info(`✅ Turso sync iniziale completata in ${elapsed}ms`);

    // Avvia sync periodica ogni 60 secondi
    const intervalMs = parseInt(process.env.TURSO_SYNC_INTERVAL) || 60000;
    syncTimer = setInterval(async () => {
      try {
        await tursoClient.sync();
        lastSyncTime = Date.now();
        logger.debug('🔄 Turso sync periodica OK');
      } catch (err) {
        logger.warn('⚠️ Turso sync periodica fallita:', { error: err.message });
      }
    }, intervalMs);

    logger.info(`⏱️ Sync periodica attiva ogni ${intervalMs / 1000}s`);

    return true;
  } catch (err) {
    logger.error('❌ Errore inizializzazione Turso:', {
      error: err.message,
      stack: err.stack
    });
    logger.warn('⚠️ Continuo con SQLite locale senza sync');
    return false;
  }
}

/**
 * Forza una sync manuale (es. prima di shutdown)
 */
async function forceSyncNow() {
  if (!tursoClient) return false;
  try {
    await tursoClient.sync();
    lastSyncTime = Date.now();
    logger.info('🔄 Turso sync manuale completata');
    return true;
  } catch (err) {
    logger.error('❌ Turso sync manuale fallita:', { error: err.message });
    return false;
  }
}

/**
 * Ferma la sync periodica
 */
function stopTursoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    logger.info('⏹️ Turso sync periodica fermata');
  }
}

/**
 * Ritorna info sullo stato della sync
 */
function getTursoStatus() {
  return {
    enabled: tursoClient !== null,
    lastSyncTime: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
    secondsSinceSync: lastSyncTime ? Math.floor((Date.now() - lastSyncTime) / 1000) : null,
  };
}

module.exports = {
  initTursoSync,
  forceSyncNow,
  stopTursoSync,
  getTursoStatus,
  getClient: () => tursoClient,
};