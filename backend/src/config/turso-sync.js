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

  if (!url || !token) {
    logger.info('ℹ️ Turso non configurato, sync disabilitata');
    return false;
  }

  // ⚠️ In produzione (Zeabur, Koyeb, ecc.) il filesystem è effimero.
  // Saltiamo la replica embedded e ci connettiamo direttamente a Turso.
  if (process.env.NODE_ENV === 'production') {
    logger.info('🌐 Modalità produzione: connessione diretta a Turso Cloud (nessuna replica locale).');
    return false;
  }

  // In sviluppo: embedded replica (come ora)
  const dbPath = path.resolve(
    process.env.DB_STORAGE || './data/musica_eventi_e_documenti_web.db'
  );

  try {
    logger.info('🔄 Inizializzazione embedded replica Turso...');
    tursoClient = createClient({
      url: `file:${dbPath}`,
      syncUrl: url,
      authToken: token,
      syncInterval: 60,
    });

    await tursoClient.sync();
    logger.info('✅ Turso sync iniziale completata');

    const intervalMs = parseInt(process.env.TURSO_SYNC_INTERVAL) || 60000;
    syncTimer = setInterval(async () => {
      try {
        await tursoClient.sync();
        lastSyncTime = Date.now();
      } catch (err) {
        logger.warn('⚠️ Turso sync periodica fallita:', { error: err.message });
      }
    }, intervalMs);

    return true;
  } catch (err) {
    logger.error('❌ Errore Turso:', { error: err.message });
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