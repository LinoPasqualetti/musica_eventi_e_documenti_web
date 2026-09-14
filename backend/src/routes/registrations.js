const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');

// ============================================
// ROUTE PUBBLICHE (utente si iscrive)
// ============================================

// Crea una nuova registrazione
router.post('/', registrationController.createRegistration);

// ============================================
// ROUTE DI LETTURA
// ============================================

// Statistiche
router.get('/stats', registrationController.getStats);

// Elenco (con filtri ?status=, ?event_id=, ?user_id=)
router.get('/', registrationController.getRegistrations);

// Dettaglio singola
router.get('/:id', registrationController.getRegistrationById);

// ============================================
// ROUTE DI AGGIORNAMENTO
// ============================================

// Aggiorna status (admin valida/rifiuta, o script sync)
router.put('/:id/status', registrationController.updateStatus);

// Segna un batch come "exported" (chiamato dallo script export)
router.post('/mark-exported', registrationController.markExported);

// Segna un batch come "published" (chiamato dallo script publish)
router.post('/mark-published', registrationController.markPublished);

// ============================================
// ROUTE DI CANCELLAZIONE
// ============================================

router.delete('/:id', registrationController.deleteRegistration);

module.exports = router;
