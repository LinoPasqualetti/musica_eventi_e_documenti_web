/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\middleware\performance.js
 *
 * 📝 DESCRIZIONE: Middleware per il monitoraggio delle performance
 * - Traccia i tempi di esecuzione delle operazioni
 * - Logger per query database lente
 * - Fornisce metodo req.measure() per misurare operazioni asincrone
 */

const logger = require('../config/logger');

/**
 * Middleware che monitora le performance delle query e delle operazioni
 */
const performanceMiddleware = (req, res, next) => {
  // Memorizza il tempo di inizio per operazioni asincrone
  req._startTime = Date.now();

  // Aggiunge un metodo per misurare il tempo delle operazioni
  req.measure = (label, startTime) => {
    const duration = Date.now() - (startTime || req._startTime);
    logger.debug(`⏱️  ${label}: ${duration}ms`, {
      correlationId: req.correlationId,
      label,
      duration
    });
    return duration;
  };

  next();
};

/**
 * Middleware per logging delle query database (da usare con Sequelize)
 */
const dbQueryLogger = (query, options) => {
  // Viene chiamato da Sequelize per ogni query
  const duration = options?.duration || 0;

  if (duration > 100) {
    logger.warn('🐢 Slow database query', {
      query: query.substring(0, 200),
      duration,
      threshold: 100
    });
  } else if (duration > 50) {
    logger.debug('Database query', {
      query: query.substring(0, 100),
      duration
    });
  }
};

module.exports = {
  performanceMiddleware,
  dbQueryLogger
};