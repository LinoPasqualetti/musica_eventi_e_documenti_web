// backend/src/routes/organs.js
const express = require('express');
const router = express.Router();
const organController = require('../controllers/organController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ============================================
// ORGANICI DI UN EVENT-SONG
// ============================================

router.get('/event-songs/:eventSongId/organs', organController.getOrgansByEventSong);
router.post('/event-songs/:eventSongId/organs', organController.createOrgan);

// ============================================
// SYNC BULK da Flutter (admin) — NUOVO 2026-09-25
// ⚠️ Deve stare PRIMA di /organs/sync e di /organs/:organId
//    altrimenti Express interpreta "sync-bulk" come :organId
// ============================================

router.post(
  '/organs/sync-bulk',
  requireAuth,
  requireAdmin,
  organController.syncBulk
);

// ============================================
// SYNC one-shot da Flutter (admin)
// ⚠️ Deve stare PRIMA di /organs/:organId
// ============================================

router.post(
  '/organs/sync',
  requireAuth,
  requireAdmin,
  organController.syncOrgan
);

// ============================================
// ORGANICI (singolo)
// ============================================

router.get('/organs/:organId', organController.getOrganById);
router.put('/organs/:organId', organController.updateOrgan);
router.delete('/organs/:organId', organController.deleteOrgan);

// ============================================
// SLOT
// ============================================

router.post('/organs/:organId/slots', organController.createSlot);
router.put('/organ-slots/:slotId', organController.updateSlot);
router.delete('/organ-slots/:slotId', organController.deleteSlot);

module.exports = router;