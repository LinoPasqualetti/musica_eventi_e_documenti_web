// backend/src/routes/registrations.js
const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const syncController = require('../controllers/syncController');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');

// ============================================
// ROUTE PUBBLICHE
// ============================================

// Conteggi slot (livello 2 - aggregati)
router.get(
  '/slots-availability/:eventSongId',
  registrationController.getSlotsAvailability
);

// ============================================
// SYNC Web <-> Flutter (solo admin)
// NOTA: queste route DEVONO stare PRIMA di /:id
// ============================================

// Pull: candidature modificate dopo <timestamp>
router.get(
  '/since',
  requireAuth,
  requireAdmin,
  syncController.pull
);

// Ack: Flutter conferma ricezione
router.post(
  '/ack',
  requireAuth,
  requireAdmin,
  syncController.ack
);

// Push: Flutter invia modifiche
router.post(
  '/push',
  requireAuth,
  requireAdmin,
  syncController.push
);

// ============================================
// ROUTE AUTENTICATE (nuovo schema)
// ============================================

// Le mie candidature
router.get('/me', requireAuth, registrationController.getMyRegistrations);

// ============================================
// ROUTE LEGACY / MISTE
// ============================================

// Statistiche
router.get('/stats', registrationController.getStats);

// Elenco (con filtri)
router.get('/', registrationController.getRegistrations);

// Dettaglio singola
router.get('/:id', registrationController.getRegistrationById);

// Crea candidatura: usa optionalAuth perché il controller decide
// se richiede auth (nuovo schema) o no (legacy).
router.post(
  '/',
  optionalAuth,
  registrationController.createRegistration
);

// Aggiorna status
router.put('/:id/status', registrationController.updateStatus);

// Batch update
router.post('/mark-exported', registrationController.markExported);
router.post('/mark-published', registrationController.markPublished);

// Delete (soft delete con owner check, se autenticato)
router.delete(
  '/:id',
  optionalAuth,
  registrationController.deleteRegistration
);

module.exports = router;