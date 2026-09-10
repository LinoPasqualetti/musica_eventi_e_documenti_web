/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\middleware\errorHandler.js
 *
 * 📝 DESCRIZIONE: Middleware per la gestione centralizzata degli errori
 * - Logga tutti gli errori con dettagli contestuali
 * - Restituisce risposte JSON strutturate
 * - Gestisce errori 404 (route non trovata)
 * - In sviluppo include lo stack trace
 */

const logger = require('../config/logger');

/**
 * Middleware globale per la gestione degli errori
 */
const errorHandler = (err, req, res, next) => {
  // Log dell'errore con dettagli
  logger.error('Unhandled error', {
    correlationId: req.correlationId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    query: req.query,
    params: req.params,
    ip: req.ip || req.connection.remoteAddress
  });

  // Determina lo status code
  const statusCode = err.status || err.statusCode || 500;

  // Risposta al client (senza stack in produzione)
  const response = {
    error: err.message || 'Internal Server Error',
    correlationId: req.correlationId
  };

  // In sviluppo, aggiungi lo stack
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Middleware per errori 404 (route non trovata)
 */
const notFoundHandler = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.url}`);
  err.status = 404;
  next(err);
};

module.exports = {
  errorHandler,
  notFoundHandler
};