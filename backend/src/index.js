/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\index.js
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
const { UPLOADS_DIR } = require('./config/paths');

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
const registrationsRoutes = require('./routes/registrations');
const mxlTempRoutes = require('./routes/mxlTemp');
const abcTempRoutes = require('./routes/abcTemp');
const organsRoutes = require('./routes/organs');
const authRoutes = require('./routes/auth');

// ============================================
// GESTIONE ERRORI NON CATTURATI (PRIMA DI TUTTO)
// ============================================
process.on('uncaughtException', (error) => {
  console.error('\n💥 ========== UNCAUGHT EXCEPTION ==========');
  console.error('Message:', error && error.message);
  console.error('Stack:', error && error.stack);
  console.error('Full error:', error);
  console.error('==========================================\n');

  try {
    logger.error('💥 Uncaught Exception:', {
      error: error && error.message,
      stack: error && error.stack,
    });
  } catch (_) {}
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 ========== UNHANDLED REJECTION ==========');
  console.error('Reason:', reason);
  if (reason && reason.stack) {
    console.error('Stack:', reason.stack);
  }
  console.error('Promise:', promise);
  console.error('==========================================\n');

  try {
    logger.error('💥 Unhandled Rejection:', {
      reason: (reason && reason.message) || reason,
      stack: reason && reason.stack,
    });
  } catch (_) {}
});

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

// ============================================
// FRONTEND STATICO (build React/Vite)
// ============================================
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.use('/soundfonts', express.static(path.join(__dirname, '../public/soundfonts')));

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
app.use('/api/registrations', registrationsRoutes);
app.use('/api/abc-temp', abcTempRoutes);
app.use('/api/mxl-temp', mxlTempRoutes);
app.use('/api', organsRoutes);
app.use('/api/auth', authRoutes);

// Forza UTF-8 SOLO sulle risposte API
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

// ============================================
// SPA FALLBACK (React Router)
// ============================================
app.get(/^\/(?!api|uploads|soundfonts).*/, (req, res, next) => {
  res.type('html').sendFile(
    path.join(__dirname, '../../frontend/dist/index.html'),
    (err) => {
      if (err) next();
    }
  );
});

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
      console.log('ℹ️  Database sync disabilitato - uso struttura esistente');
      logger.info('📦 Database models synced');
    }

    // 4. Avvia il server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
      logger.info(`📝 Logs directory: ${path.join(__dirname, '../logs')}`);

      const models = Object.keys(sequelize.models);
      if (models.length > 0) {
        logger.info(`📚 Models loaded: ${models.join(', ')}`);
      }
    });

    server.on('error', (err) => {
      console.error('\n💥 ========== SERVER ERROR ==========');
      console.error(err);
      console.error(err.stack);
      console.error('====================================\n');
    });

  } catch (error) {
    console.error('\n💥 ========== STARTUP FAILED ==========');
    console.error(error);
    console.error(error.stack);
    console.error('======================================\n');
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

  stopTursoSync();

  try {
    await forceSyncNow();
  } catch (e) {
    logger.warn('⚠️ Sync finale fallita:', { error: e.message });
  }

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
// AVVIO
// ============================================
startServer();