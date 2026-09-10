/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\routes\songs.js
 *
 * 📝 DESCRIZIONE: Route per la gestione delle canzoni
 */

const express = require('express');
const router = express.Router();
const songController = require('../controllers/songController');

// VERIFICA: I controller sono stati importati correttamente?
console.log('📦 songController importato:', Object.keys(songController));

// ============================================
// ROTTE
// ============================================

// GET /api/songs/event/:eventId - Canzoni di un evento
router.get('/event/:eventId', songController.getSongsByEvent);

// GET /api/songs/:id - Dettaglio canzone
router.get('/:id', songController.getSongById);

// GET /api/songs/:id/documents - Documenti di una canzone
router.get('/:id/documents', songController.getSongDocuments);

// POST /api/songs - Crea nuova canzone
router.post('/', songController.createSong);

// PUT /api/songs/:id - Aggiorna canzone
router.put('/:id', songController.updateSong);

// DELETE /api/songs/:id - Elimina canzone
router.delete('/:id', songController.deleteSong);

module.exports = router;