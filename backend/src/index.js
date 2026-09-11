/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\index.js
 *
 * 📝 DESCRIZIONE: Punto di ingresso principale del server
 * - Configurazione Express con tutti i middleware
 * - Gestione CORS, Helmet, Compressione
 * - Middleware personalizzati (correlationId, performance, errorHandler)
 * - Connessione al database + Turso embedded replica
 * - Routes API
 * - Gestione errori e shutdown graceful
 */

// ============================================
// IMPORTAZIONI
// ============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// Logger
const logger = require('./config/logger');

// Middleware personalizzati
const correlationIdMiddleware = require('./middleware/correlationId');
const { performanceMiddleware } = require('./middleware/performance');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Database
const { sequelize, testConnection } = require('./config/database');

// Turso sync (embedded replica)
const {
  initTursoSync,
  forceSyncNow,
  stopTursoSync,
  getTursoStatus,
} = require('./config/turso-sync');

// Routes
const songsRoutes = require('./routes/songs');
const eventsRoutes = require('./routes/events');
const documentsRoutes = require('./routes/documents');

// ============================================
// INIZIALIZZAZIONE APP
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE GLOBALI
// ============================================

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: false,
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  exposedHeaders: ['X-Correlation-Id', 'X-Response-Time']
}));

// Compressione
app.use(compression());

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// MIDDLEWARE PERSONALIZZATI
// ============================================

// 1. Correlation ID + Performance
app.use(correlationIdMiddleware);
app.use(performanceMiddleware);

// 2. Logging delle richieste (solo in sviluppo)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    logger.debug(`➡️  ${req.method} ${req.url}`, {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      query: req.query,
      ip: req.ip || req.connection.remoteAddress
    });
    next();
  });
}

// 3. Request timeout
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    const err = new Error('Request timeout');
    err.status = 408;
    next(err);
  });
  next();
});

// ============================================
// ROTTE
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    correlationId: req.correlationId,
    turso: getTursoStatus(),
  });
});

// API Routes
app.use('/api/songs', songsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/documents', documentsRoutes);

// ============================================
// GESTIONE ERRORI
// ============================================

// 404 - Route not found
app.use(notFoundHandler);

// Error handler globale
app.use(errorHandler);

// ============================================
// AVVIO SERVER
// ============================================

async function startServer() {
  try {
    // 1. Inizializza sync Turso (pull dal cloud PRIMA di Sequelize)
    const tursoEnabled = await initTursoSync();
    if (tursoEnabled) {
      logger.info('🔄 Turso embedded replica attiva');
    } else {
      logger.info('ℹ️ Turso embedded replica disattivata (solo SQLite locale)');
    }

    // 2. Test connessione database locale
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('❌ Database connection failed. Exiting...');
      process.exit(1);
    }

    // 3. Sincronizza i modelli (solo in sviluppo)
    if (process.env.NODE_ENV !== 'production') {
      // SYNC DISABILITATO - uso database esistente
      console.log('ℹ️  Database sync disabilitato - uso struttura esistente');
      // await sequelize.sync({ alter: true });
      logger.info('📦 Database models synced');
    }

    // 4. Avvia il server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
      logger.info(`📝 Logs directory: ${path.join(__dirname, '../logs')}`);

      // Mostra i modelli caricati
      const models = Object.keys(sequelize.models);
      if (models.length > 0) {
        logger.info(`📚 Models loaded: ${models.join(', ')}`);
      }
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// ============================================
// SHUTDOWN GRACEFUL
// ============================================

async function gracefulShutdown(signal) {
  logger.info(`🛑 ${signal} received. Shutting down gracefully...`);

  // 1. Ferma sync periodica
  stopTursoSync();

  // 2. Push finale verso Turso (best effort)
  try {
    await forceSyncNow();
  } catch (e) {
    logger.warn('⚠️ Sync finale fallita:', { error: e.message });
  }

  // 3. Chiudi Sequelize
  try {
    await sequelize.close();
    logger.info('✅ Database connection closed.');
  } catch (e) {
    logger.warn('⚠️ Errore chiusura Sequelize:', { error: e.message });
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// GESTIONE ERRORI NON CATTURATI
// ============================================

process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection:', {
    reason: reason?.message || reason,
    promise: promise
  });
});

// ============================================
// AVVIO
// ============================================
startServer();