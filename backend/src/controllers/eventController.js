/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\controllers\eventController.js
 *
 * 📝 DESCRIZIONE: Controller per la gestione degli eventi
 * - CRUD completo per eventi
 * - Conteggio documenti specifici dell'evento (per song_id)
 * - Statistiche aggregate
 */

const { Event, Song, Document, EventSong, EventSongDocument } = require('../models');
const { sequelize } = require('../config/database');
const { QueryTypes, Op } = require('sequelize');
const logger = require('../config/logger');

// ============================================
// FUNZIONI DEL CONTROLLER
// ============================================

/**
 * Ottieni tutti gli eventi con filtri
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
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const events = await Event.findAll({
      where,
      include: [
        {
          model: Song,
          as: 'songs',
          include: [
            {
              model: Document,
              as: 'documents'
            }
          ]
        }
      ]
    });

    logger.info(`📊 Eventi trovati: ${events.length}`, {
      correlationId: req.correlationId,
      count: events.length,
      filters: { category, difficulty, search }
    });

    res.json(events);
  } catch (error) {
    logger.error('Errore nel caricamento eventi', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Ottieni un singolo evento con dettagli
 */
exports.getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id, {
      include: [
        {
          model: Song,
          as: 'songs',
          include: [
            {
              model: Document,
              as: 'documents'
            }
          ]
        }
      ]
    });

    if (!event) {
      const err = new Error(`Event ${id} not found`);
      err.status = 404;
      return next(err);
    }

    logger.debug(`Evento trovato: ${event.title}`, {
      correlationId: req.correlationId,
      eventId: id
    });

    res.json(event);
  } catch (error) {
    next(error);
  }
};

/**
 * Conteggio documenti specifici dell'evento, raggruppati per song_id.
 * Corrisponde a DatabaseService.getEventSongDocumentsCountForEvent()
 * dell'app desktop: usa solo event_song_documents, non i documenti
 * globali del brano.
 *
 * La route è definita come '/:eventId/document-counts', quindi il
 * parametro arriva come req.params.eventId (NON req.params.id).
 *
 * Risposta: { songId: count, ... }
 */
exports.getDocumentCountsForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    // Verifica esistenza evento (404 chiaro invece di {} silenzioso)
    const event = await Event.findByPk(eventId);
    if (!event) {
      const err = new Error(`Event ${eventId} not found`);
      err.status = 404;
      return next(err);
    }

    // JOIN event_song_documents → event_songs, raggruppato per song_id
    const rows = await sequelize.query(
      `SELECT es.song_id AS song_id, COUNT(esd.id) AS doc_count
       FROM event_songs es
       LEFT JOIN event_song_documents esd ON esd.event_song_id = es.id
       WHERE es.event_id = :eventId
       GROUP BY es.song_id`,
      {
        replacements: { eventId },
        type: QueryTypes.SELECT
      }
    );

    // Trasforma in mappa { songId: count }
    const counts = {};
    for (const row of rows) {
      counts[row.song_id] = Number(row.doc_count) || 0;
    }

    logger.info(`📊 Conteggi documenti per evento ${eventId}: ${Object.keys(counts).length} brani`, {
      correlationId: req.correlationId,
      eventId,
      counts
    });

    res.json(counts);
  } catch (error) {
    logger.error('Errore nel conteggio documenti evento', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack
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
      image_url
    });

    logger.info(`Evento creato: ${title}`, {
      correlationId: req.correlationId,
      eventId: id
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
      image_url
    });

    logger.info(`Evento aggiornato: ${event.title}`, {
      correlationId: req.correlationId,
      eventId: id
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

    const event = await Event.findByPk(id);
    if (!event) {
      const err = new Error(`Event ${id} not found`);
      err.status = 404;
      return next(err);
    }

    await event.destroy();

    logger.info(`Evento eliminato: ${event.title}`, {
      correlationId: req.correlationId,
      eventId: id
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