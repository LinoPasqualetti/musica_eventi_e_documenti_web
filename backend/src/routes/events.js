/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\routes\events.js
 */

const express = require('express');
const router = express.Router();

const eventController = require('../controllers/eventController');
const songController = require('../controllers/songController');
const documentController = require('../controllers/documentController');

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