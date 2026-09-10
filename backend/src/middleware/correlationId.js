/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\middleware\correlationId.js
 *
 * 📝 DESCRIZIONE: Middleware per tracciare le richieste con un ID univoco
 * - Genera o propaga correlation ID dagli header
 * - Misura il tempo di risposta di ogni richiesta
 * - Logga richieste lente (> 1 secondo)
 * - Aggiunge X-Correlation-Id all'header di risposta
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

/**
 * Middleware che genera e propaga un correlation ID per tracciare
 * una richiesta attraverso tutto il sistema.
 */
const correlationIdMiddleware = (req, res, next) => {
  // Prendi l'ID dall'header o generane uno nuovo
  const correlationId = req.headers['x-correlation-id'] || uuidv4();

  // Salva nell'oggetto request per usarlo nei controller
  req.correlationId = correlationId;

  // Aggiungi all'header di risposta per il frontend
  res.setHeader('X-Correlation-Id', correlationId);

  // Salva il metodo original send per loggare il tempo di risposta
  const start = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    const duration = Date.now() - start;
    res.duration = duration;

    // Log della risposta
    logger.debug('Request completed', {
      correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent'),
      ip: req.ip || req.connection.remoteAddress
    });

    // Avviso per richieste lente
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        correlationId,
        method: req.method,
        url: req.url,
        duration,
        threshold: 1000
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

module.exports = correlationIdMiddleware;