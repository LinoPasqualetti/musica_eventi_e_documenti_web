/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\controllers\eventController.js
 *
 * 📝 DESCRIZIONE: Controller per la gestione degli eventi
 * - CRUD completo per eventi
 * - Conteggio documenti specifici dell'evento (per song_id)
 * - Statistiche aggregate
 *
 * 🔥 FIX APPLICATI:
 *   - Esclude il campo `content` (BLOB) da Document → evita OOM
 *   - Esclude `lyrics` (TEXT lungo) da Song → alleggerisce le liste
 *   - Esclude `description`, `contact_email`, `contact_phone`, `video_url` da Event
 *   - Mapping esplicito su getEventById (no oggetti Sequelize circolari)
 *   - getEvents e getEventById ora restituiscono payload molto più piccoli
 */

const { Event, Song, Document, EventSong, EventSongDocument } = require('../models');
const { sequelize } = require('../config/database');
const { QueryTypes, Op } = require('sequelize');
const logger = require('../config/logger');

// ============================================
// COSTANTI: ATTRIBUTI "LEGGERI"
// ============================================

/**
 * Document: esclude il BLOB `content`.
 * Il BLOB viene servito on-demand da GET /api/documents/:id/content.
 */
const DOCUMENT_LIST_ATTRIBUTES = [
  'id',
  'doc_type',
  'file_name',
  'file_path',
  'file_size',
  'description',
  'is_public',
  'uploaded_by',
  'created_at',
  'updated_at',
  'storage_mode',
  'mime_type',
  // NOTA: 'content' escluso
];

/**
 * Song: esclude `lyrics` (TEXT lungo non necessario nelle liste).
 */
const SONG_LIST_ATTRIBUTES = [
  'id',
  'title',
  'composer',
  'created_by',
  'created_at',
  'updated_at',
  'difficulty',
  'genre',
  'duration_seconds',
  'tempo',
  'key_signature',
  'time_signature',
  // NOTA: 'lyrics' escluso
];

/**
 * Event: per le liste, esclude descrizione e contatti (usati solo nel dettaglio).
 */
const EVENT_LIST_ATTRIBUTES = [
  'id',
  'title',
  'theme',
  'image_url',
  'date',
  'location',
  'category',
  'status',
  'capacity',
  'registration_deadline',
  'difficulty',
  'duration',
  'created_by',
  'created_at',
  'updated_at',
  // NOTA: 'description', 'contact_email', 'contact_phone', 'video_url' esclusi
];

// ============================================
// FUNZIONI DEL CONTROLLER
// ============================================

/**
 * GET /api/events
 * Ottieni tutti gli eventi con filtri. Payload "leggero".
 */
exports.getEvents = async (req, res, next) => {
  try {
    const { category, difficulty, search } = req.query;

    const where = {};
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const events = await Event.findAll({
      where,
      attributes: EVENT_LIST_ATTRIBUTES,
      include: [
        {
          model: Song,
          as: 'songs',
          attributes: SONG_LIST_ATTRIBUTES, // 🔥 esclude 'lyrics'
          through: { attributes: ['order_index', 'notes'] },
          include: [
            {
              model: Document,
              as: 'documents',
              attributes: DOCUMENT_LIST_ATTRIBUTES, // 🔥 esclude 'content'
              through: { attributes: ['order_index', 'notes'] },
            },
          ],
        },
      ],
    });

    logger.info(`📊 Eventi trovati: ${events.length}`, {
      correlationId: req.correlationId,
      count: events.length,
      filters: { category, difficulty, search },
    });

    res.json(events);
  } catch (error) {
    logger.error('Errore nel caricamento eventi', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * GET /api/events/:id
 * Dettaglio evento singolo. Include la descrizione completa (serve al dettaglio).
 * Restituisce un payload leggero sul resto.
 */
exports.getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id, {
      // Nel dettaglio l'Event completo (con description, contact_*) può servire
      // Se il frontend non li usa, aggiungi anche qui EVENT_LIST_ATTRIBUTES.
      include: [
        {
          model: Song,
          as: 'songs',
          attributes: SONG_LIST_ATTRIBUTES, // 🔥 esclude 'lyrics'
          through: { attributes: ['order_index', 'notes'] },
          include: [
            {
              model: Document,
              as: 'documents',
              attributes: DOCUMENT_LIST_ATTRIBUTES, // 🔥 esclude 'content'
              through: { attributes: ['order_index', 'notes'] },
            },
          ],
        },
      ],
    });

    if (!event) {
      const err = new Error(`Event ${id} not found`);
      err.status = 404;
      return next(err);
    }

    logger.debug(`Evento trovato: ${event.title}`, {
      correlationId: req.correlationId,
      eventId: id,
    });

    res.json(event);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:eventId/document-counts
 * Conteggio documenti specifici dell'evento, raggruppati per song_id.
 */
exports.getDocumentCountsForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    // Solo verifica esistenza — non serve caricare tutto l'evento
    const event = await Event.findByPk(eventId, {
      attributes: ['id', 'title'],
    });
    if (!event) {
      const err = new Error(`Event ${eventId} not found`);
      err.status = 404;
      return next(err);
    }

    const rows = await sequelize.query(
      `SELECT es.song_id AS song_id, COUNT(esd.id) AS doc_count
       FROM event_songs es
       LEFT JOIN event_song_documents esd ON esd.event_song_id = es.id
       WHERE es.event_id = :eventId
       GROUP BY es.song_id`,
      {
        replacements: { eventId },
        type: QueryTypes.SELECT,
      }
    );

    const counts = {};
    for (const row of rows) {
      counts[row.song_id] = Number(row.doc_count) || 0;
    }

    logger.info(`📊 Conteggi documenti per evento ${eventId}: ${Object.keys(counts).length} brani`, {
      correlationId: req.correlationId,
      eventId,
      counts,
    });

    res.json(counts);
  } catch (error) {
    logger.error('Errore nel conteggio documenti evento', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * Crea un nuovo evento
 */
exports.createEvent = async (req, res, next) => {
  try {
    const { id, title, description, category, difficulty, date, location, image_url } = req.body;

    const event = await Event.create({
      id,
      title,
      description,
      category,
      difficulty,
      date,
      location,
      image_url,
    });

    logger.info(`Evento creato: ${title}`, {
      correlationId: req.correlationId,
      eventId: id,
    });

    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
};

/**
 * Aggiorna un evento
 */
exports.updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, category, difficulty, date, location, image_url } = req.body;

    const event = await Event.findByPk(id);
    if (!event) {
      const err = new Error(`Event ${id} not found`);
      err.status = 404;
      return next(err);
    }

    await event.update({
      title,
      description,
      category,
      difficulty,
      date,
      location,
      image_url,
    });

    logger.info(`Evento aggiornato: ${event.title}`, {
      correlationId: req.correlationId,
      eventId: id,
    });

    res.json(event);
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina un evento
 */
exports.deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id, {
      attributes: ['id', 'title'], // solo per log
    });
    if (!event) {
      const err = new Error(`Event ${id} not found`);
      err.status = 404;
      return next(err);
    }

    await event.destroy();

    logger.info(`Evento eliminato: ${event.title}`, {
      correlationId: req.correlationId,
      eventId: id,
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Statistiche degli eventi
 */
exports.getEventStats = async (req, res, next) => {
  try {
    const stats = await sequelize.query(
      `SELECT
        category,
        COUNT(*) as count,
        AVG(difficulty) as avg_difficulty
      FROM Events
      GROUP BY category`,
      { type: QueryTypes.SELECT }
    );

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

// ============================================
// VERIFICA ESPORTAZIONI (solo in sviluppo)
// ============================================
if (process.env.NODE_ENV !== 'production') {
  console.log('✅ eventController esporta:', Object.keys(exports));
}