/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\routes\events.js
 */

const express = require('express');
const router = express.Router();

const eventController = require('../controllers/eventController');
const songController = require('../controllers/songController');
const documentController = require('../controllers/documentController');
const registrationController = require('../controllers/registrationController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
// VERIFICA: I controller sono stati importati correttamente?
console.log('eventController:', Object.keys(eventController));
console.log('songController:', Object.keys(songController));
console.log('documentController:', Object.keys(documentController));

// ============================================
// ROTTE NIDIFICATE (vanno PRIMA di /:id)
// ============================================

/**
 * GET /api/events/:eventId/document-counts
 * Conteggio documenti specifici dell'evento, per song_id.
 * Risposta: { songId: count, ... }
 */
router.get('/:eventId/document-counts', eventController.getDocumentCountsForEvent);
/**
 * GET /api/events/:eventId/registrations
 * Admin - tutte le candidature dell'evento
 */
router.get(
  '/:eventId/registrations',
  requireAuth,
  requireAdmin,
  registrationController.getRegistrationsByEvent
);
/**
 * GET /api/events/:eventId/songs/:songId/event-song-id
 * Ritorna l'id di event_songs per (event_id, song_id).
 * Usato dal frontend per aprire la pagina candidatura.
 */
router.get(
  '/:eventId/songs/:songId/event-song-id',
  async (req, res, next) => {
    try {
      const { eventId, songId } = req.params;
      const { EventSong } = require('../models');
      const es = await EventSong.findOne({
        where: { event_id: eventId, song_id: songId },
        attributes: ['id'],
      });
      if (!es) {
        return res.status(404).json({ error: 'EventSong non trovato' });
      }
      res.json({ eventSongId: es.id });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/events/:eventId/songs
 */
router.get('/:eventId/songs', songController.getSongsByEvent);

/**
 * GET /api/events/:eventId/songs/:songId/documents
 */
router.get('/:eventId/songs/:songId/documents', (req, res, next) => {
  return documentController.getDocumentsBySong(req, res, next);
});

// ============================================
// ROTTE EVENTO
// ============================================

router.get('/', eventController.getEvents);
router.get('/:id/stats', eventController.getEventStats);
router.get('/:id', eventController.getEventById);
router.post('/', eventController.createEvent);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

module.exports = router;