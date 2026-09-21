/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\controllers\songController.js
 *
 * 📝 DESCRIZIONE: Controller per la gestione delle canzoni
 *
 * 🔧 OTTIMIZZAZIONI APPLICATE:
 *   - Esclusione del BLOB `documents.content` in tutte le query (evita OOM + query lente)
 *   - Mapping esplicito della risposta (no oggetti Sequelize circolari)
 *   - Esclusione di campi pesanti non necessari (lyrics, description) nelle liste
 */

const { Song, Event, Document, EventSong, SongDocument } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

// ============================================
// ATTRIBUTI RIUTILIZZABILI
// ============================================

/**
 * Attributi "leggeri" dei Document, senza il BLOB `content`.
 * Usati in tutte le query che restituiscono liste di documenti.
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
  // NOTA: 'content' è volutamente escluso (BLOB pesante)
];

/**
 * Attributi "leggeri" della Song, senza `lyrics` (TEXT lungo non necessario nelle liste).
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
 * Attributi "leggeri" dell'Event.
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
  // NOTA: 'description', 'contact_email', 'contact_phone', 'video_url' esclusi
];

// ============================================
// FUNZIONI DEL CONTROLLER
// ============================================

/**
 * Ottieni tutte le canzoni di un evento (con documenti).
 * GET /api/events/:eventId/songs
 */
exports.getSongsByEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const songs = await Song.findAll({
      attributes: SONG_LIST_ATTRIBUTES,
      include: [
        {
          model: Event,
          as: 'events',
          attributes: EVENT_LIST_ATTRIBUTES,
          through: { model: EventSong, attributes: ['order_index', 'notes'] },
          where: { id: eventId },
          required: true,
        },
        {
          model: Document,
          as: 'documents',
          attributes: DOCUMENT_LIST_ATTRIBUTES, // 🔥 esclude 'content'
          through: { model: SongDocument, attributes: ['order_index', 'notes'] },
          required: false,
        },
      ],
      order: [[{ model: Event, as: 'events' }, EventSong, 'order_index', 'ASC']],
    });

    // 🔥 Mapping esplicito: niente oggetti Sequelize grezzi, niente rischio JSON circular
    const result = songs.map((s) => {
      const firstEvent = s.events?.[0];
      return {
        id: s.id,
        title: s.title,
        composer: s.composer,
        difficulty: s.difficulty,
        genre: s.genre,
        duration_seconds: s.duration_seconds,
        tempo: s.tempo,
        key_signature: s.key_signature,
        time_signature: s.time_signature,
        created_by: s.created_by,
        created_at: s.created_at,
        updated_at: s.updated_at,
        order_index: firstEvent?.EventSong?.order_index ?? 0,
        notes: firstEvent?.EventSong?.notes ?? '',
        documents: (s.documents || []).map((d) => ({
          id: d.id,
          doc_type: d.doc_type,
          file_name: d.file_name,
          file_path: d.file_path,
          file_size: d.file_size,
          description: d.description,
          is_public: d.is_public,
          uploaded_by: d.uploaded_by,
          created_at: d.created_at,
          updated_at: d.updated_at,
          storage_mode: d.storage_mode,
          mime_type: d.mime_type,
          order_index: d.SongDocument?.order_index ?? 0,
          notes: d.SongDocument?.notes ?? '',
          // NON includiamo 'content'
        })),
      };
    });

    logger.info(`🎵 Brani trovati: ${result.length}`, {
      correlationId: req.correlationId,
      eventId,
      count: result.length,
    });

    res.json(result);
  } catch (error) {
    logger.error('Errore nel caricamento brani', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * GET /api/songs
 * Elenco di tutte le canzoni, con filtri opzionali.
 * Query params: ?difficulty=...&genre=...&limit=...&offset=...
 */
exports.getAllSongs = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.difficulty) where.difficulty = req.query.difficulty;
    if (req.query.genre) where.genre = req.query.genre;

    const limit = parseInt(req.query.limit, 10) || 1000;
    const offset = parseInt(req.query.offset, 10) || 0;

    const songs = await Song.findAll({
      attributes: SONG_LIST_ATTRIBUTES,
      where,
      order: [['title', 'ASC']],
      limit,
      offset,
    });

    res.json(songs);
  } catch (error) {
    next(error);
  }
};

/**
 * Ottieni una canzone specifica con i suoi documenti.
 * GET /api/songs/:id
 */
exports.getSongById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const song = await Song.findByPk(id, {
      attributes: SONG_LIST_ATTRIBUTES,
      include: [
        {
          model: Event,
          as: 'events',
          attributes: EVENT_LIST_ATTRIBUTES,
          through: { attributes: ['order_index', 'notes'] },
        },
        {
          model: Document,
          as: 'documents',
          attributes: DOCUMENT_LIST_ATTRIBUTES, // 🔥 esclude 'content'
          through: { model: SongDocument, attributes: ['order_index', 'notes'] },
        },
      ],
    });

    if (!song) {
      const err = new Error(`Song ${id} not found`);
      err.status = 404;
      return next(err);
    }

    logger.debug(`Brano trovato: ${song.title}`, {
      correlationId: req.correlationId,
      songId: id,
    });

    res.json(song);
  } catch (error) {
    next(error);
  }
};

/**
 * Ottieni i documenti di una canzone.
 * GET /api/songs/:id/documents
 */
exports.getSongDocuments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const song = await Song.findByPk(id, {
      attributes: ['id'],
      include: [
        {
          model: Document,
          as: 'documents',
          attributes: DOCUMENT_LIST_ATTRIBUTES, // 🔥 esclude 'content'
          through: { model: SongDocument, attributes: ['order_index', 'notes'] },
        },
      ],
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
 * Crea una nuova canzone e la collega a un evento.
 */
exports.createSong = async (req, res, next) => {
  try {
    const {
      id, eventId, title, composer, difficulty, genre,
      duration_seconds, tempo, key_signature, time_signature, lyrics,
    } = req.body;

    const event = await Event.findByPk(eventId);
    if (!event) {
      const err = new Error(`Event ${eventId} not found`);
      err.status = 404;
      return next(err);
    }

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
      lyrics,
    });

    await EventSong.create({
      id: `es_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      event_id: eventId,
      song_id: id,
      order_index: 0,
      created_at: new Date().toISOString(),
    });

    logger.info(`Brano creato: ${title}`, {
      correlationId: req.correlationId,
      songId: id,
      eventId,
    });

    res.status(201).json(song);
  } catch (error) {
    next(error);
  }
};

/**
 * Aggiorna una canzone.
 */
exports.updateSong = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title, composer, difficulty, genre,
      duration_seconds, tempo, key_signature, time_signature, lyrics,
    } = req.body;

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
      updated_at: new Date().toISOString(),
    });

    logger.info(`Brano aggiornato: ${song.title}`, {
      correlationId: req.correlationId,
      songId: id,
    });

    res.json(song);
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina una canzone (e i suoi documenti per cascata).
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

    await EventSong.destroy({ where: { song_id: id } });
    await SongDocument.destroy({ where: { song_id: id } });
    await song.destroy();

    logger.info(`Brano eliminato: ${song.title}`, {
      correlationId: req.correlationId,
      songId: id,
    });

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Collega un documento a una canzone.
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

    const document = await Document.findByPk(documentId, {
      attributes: ['id'], // solo per verifica esistenza
    });
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
      created_at: new Date().toISOString(),
    });

    logger.info(`Documento collegato alla canzone`, {
      correlationId: req.correlationId,
      songId,
      documentId,
    });

    res.status(201).json(link);
  } catch (error) {
    next(error);
  }
};

/**
 * Rimuovi un documento da una canzone.
 */
exports.unlinkDocument = async (req, res, next) => {
  try {
    const { songId, documentId } = req.params;

    const link = await SongDocument.findOne({
      where: { song_id: songId, document_id: documentId },
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
      documentId,
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