/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\config\logger.js
 *
 * 📝 DESCRIZIONE: Configurazione del sistema di logging Winston
 * - Log su file in formato JSON per analisi
 * - Log su console colorata in sviluppo
 * - Rotazione automatica dei file (10MB)
 * - Separazione errori in file dedicato
 */

const winston = require('winston');
const path = require('path');
const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Formato per console (leggibile)
const consoleFormat = printf(({ level, message, timestamp, correlationId, duration, ...meta }) => {
  let log = `${timestamp} [${level}]`;
  if (correlationId) log += ` [${correlationId.substring(0, 8)}]`;
  log += ` ${message}`;
  if (duration) log += ` (${duration}ms)`;
  if (Object.keys(meta).length > 0) {
    log += ` | ${JSON.stringify(meta)}`;
  }
  return log;
});

// Formato per file JSON (analisi)
const jsonFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// Logger principale
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  transports: [
    // Log generale
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: jsonFormat
    }),
    // Log degli errori separati
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
      format: jsonFormat
    })
  ]
});

// Console transport: sempre attivo (anche in produzione, così i log finiscono su stdout)
logger.add(new winston.transports.Console({
  format: combine(
    colorize(),
    timestamp({ format: 'HH:mm:ss' }),
    consoleFormat
  ),
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}));

module.exports = logger;