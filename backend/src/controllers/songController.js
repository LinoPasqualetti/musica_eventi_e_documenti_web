/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\controllers\songController.js
 *
 * 📝 DESCRIZIONE: Controller per la gestione delle canzoni
 */

const { Song, Event, Document, EventSong, SongDocument } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

// ============================================
// FUNZIONI DEL CONTROLLER
// ============================================

/**
 * Ottieni tutte le canzoni di un evento (con documenti)
 */
exports.getSongsByEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const songs = await Song.findAll({
      include: [
        {
          model: Event,
          as: 'events',
          through: { model: EventSong, attributes: ['order_index', 'notes'] },
          where: { id: eventId },
          required: true
        },
        {
          model: Document,
          as: 'documents',
          through: { model: SongDocument, attributes: ['order_index', 'notes'] },
          required: false
        }
      ],
      order: [[{ model: Event, as: 'events' }, EventSong, 'order_index', 'ASC']]
    });

    logger.info(`🎵 Brani trovati: ${songs.length}`, {
      correlationId: req.correlationId,
      eventId,
      count: songs.length
    });

    res.json(songs);
  } catch (error) {
    logger.error('Errore nel caricamento brani', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Ottieni una canzone specifica con i suoi documenti
 */
exports.getSongById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const song = await Song.findByPk(id, {
      include: [
        {
          model: Event,
          as: 'events',
          through: { attributes: ['order_index', 'notes'] }
        },
        {
          model: Document,
          as: 'documents',
          through: { model: SongDocument, attributes: ['order_index', 'notes'] }
        }
      ]
    });

    if (!song) {
      const err = new Error(`Song ${id} not found`);
      err.status = 404;
      return next(err);
    }

    logger.debug(`Brano trovato: ${song.title}`, {
      correlationId: req.correlationId,
      songId: id
    });

    res.json(song);
  } catch (error) {
    next(error);
  }
};

/**
 * Ottieni i documenti di una canzone
 */
exports.getSongDocuments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const song = await Song.findByPk(id, {
      include: [
        {
          model: Document,
          as: 'documents',
          through: { model: SongDocument, attributes: ['order_index', 'notes'] }
        }
      ]
    });

    if (!song) {
      const err = new Error(`Song ${id} not found`);
      err.status = 404;
      return next(err);
    }

    res.json(song.documents || []);
  } catch (error) {
    next(error);
  }
};

/**
 * Crea una nuova canzone e la collega a un evento
 */
exports.createSong = async (req, res, next) => {
  try {
    const { id, eventId, title, composer, difficulty, genre, duration_seconds, tempo, key_signature, time_signature, lyrics } = req.body;

    // Verifica che l'evento esista
    const event = await Event.findByPk(eventId);
    if (!event) {
      const err = new Error(`Event ${eventId} not found`);
      err.status = 404;
      return next(err);
    }

    // Crea la canzone
    const song = await Song.create({
      id,
      title,
      composer,
      created_by: req.user?.id || 'system',
      created_at: new Date().toISOString(),
      difficulty,
      genre,
      duration_seconds,
      tempo,
      key_signature,
      time_signature,
      lyrics
    });

    // Collega la canzone all'evento
    await EventSong.create({
      id: `es_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      event_id: eventId,
      song_id: id,
      order_index: 0,
      created_at: new Date().toISOString()
    });

    logger.info(`Brano creato: ${title}`, {
      correlationId: req.correlationId,
      songId: id,
      eventId
    });

    res.status(201).json(song);
  } catch (error) {
    next(error);
  }
};

/**
 * Aggiorna una canzone
 */
exports.updateSong = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, composer, difficulty, genre, duration_seconds, tempo, key_signature, time_signature, lyrics } = req.body;

    const song = await Song.findByPk(id);
    if (!song) {
      const err = new Error(`Song ${id} not found`);
      err.status = 404;
      return next(err);
    }

    await song.update({
      title,
      composer,
      difficulty,
      genre,
      duration_seconds,
      tempo,
      key_signature,
      time_signature,
      lyrics,
      updated_at: new Date().toISOString()
    });

    logger.info(`Brano aggiornato: ${song.title}`, {
      correlationId: req.correlationId,
      songId: id
    });

    res.json(song);
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina una canzone (e i suoi documenti per cascata)
 */
exports.deleteSong = async (req, res, next) => {
  try {
    const { id } = req.params;

    const song = await Song.findByPk(id);
    if (!song) {
      const err = new Error(`Song ${id} not found`);
      err.status = 404;
      return next(err);
    }

    // Elimina le relazioni
    await EventSong.destroy({ where: { song_id: id } });
    await SongDocument.destroy({ where: { song_id: id } });

    // Elimina la canzone
    await song.destroy();

    logger.info(`Brano eliminato: ${song.title}`, {
      correlationId: req.correlationId,
      songId: id
    });

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Collega un documento a una canzone
 */
exports.linkDocument = async (req, res, next) => {
  try {
    const { songId, documentId } = req.params;
    const { order_index, notes } = req.body;

    const song = await Song.findByPk(songId);
    if (!song) {
      const err = new Error(`Song ${songId} not found`);
      err.status = 404;
      return next(err);
    }

    const document = await Document.findByPk(documentId);
    if (!document) {
      const err = new Error(`Document ${documentId} not found`);
      err.status = 404;
      return next(err);
    }

    const link = await SongDocument.create({
      id: `sd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      song_id: songId,
      document_id: documentId,
      order_index: order_index || 0,
      notes: notes || null,
      created_at: new Date().toISOString()
    });

    logger.info(`Documento collegato alla canzone`, {
      correlationId: req.correlationId,
      songId,
      documentId
    });

    res.status(201).json(link);
  } catch (error) {
    next(error);
  }
};

/**
 * Rimuovi un documento da una canzone
 */
exports.unlinkDocument = async (req, res, next) => {
  try {
    const { songId, documentId } = req.params;

    const link = await SongDocument.findOne({
      where: { song_id: songId, document_id: documentId }
    });

    if (!link) {
      const err = new Error(`Link between Song ${songId} and Document ${documentId} not found`);
      err.status = 404;
      return next(err);
    }

    await link.destroy();

    logger.info(`Documento rimosso dalla canzone`, {
      correlationId: req.correlationId,
      songId,
      documentId
    });

    res.json({ message: 'Document unlinked from song successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================
// VERIFICA ESPORTAZIONI (solo in sviluppo)
// ============================================
if (process.env.NODE_ENV !== 'production') {
  console.log('✅ songController esporta:', Object.keys(exports));
}