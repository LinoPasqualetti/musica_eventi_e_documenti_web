// [MODIFICA] C:\musica_eventi_e_documenti_web\backend\src\routes\documents.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const documentController = require('../controllers/documentController');
const { UPLOADS_DIR } = require('../config/paths');

// ============================================
// Multer: memoryStorage (i file vengono gestiti dal controller)
// ============================================
const uploadBig = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB
});

// ============================================
// ROTTE
// ============================================
// ⚠️ ORDINE IMPORTANTE: le route statiche (/sync, /upload-big) vanno
// registrate PRIMA di /:id, altrimenti Express le interpreta come id.

// GET /api/documents - lista di tutti i documenti (metadati)
router.get('/', documentController.getAllDocuments);

// POST /api/documents/sync - riceve un BLOB base64 dal desktop
router.post('/sync', documentController.syncDocument);

// POST /api/documents/upload-big - riceve un file multipart (file grandi)
router.post('/upload-big', uploadBig.single('file'), documentController.uploadBigDocument);

// GET /api/documents/song/:songId - documenti di un brano
router.get('/song/:songId', documentController.getDocumentsBySong);

// GET /api/documents/:id - dettaglio documento
router.get('/:id', documentController.getDocument);

// GET /api/documents/:id/view - metadati + URL contenuto
router.get('/:id/view', documentController.viewDocument);

// GET /api/documents/:id/content - contenuto (streaming)
router.get('/:id/content', documentController.getDocumentContent);

// POST /api/documents/song/:songId - upload tradizionale (legacy, per il web)
router.post('/song/:songId', uploadBig.single('file'), documentController.uploadDocument);

// DELETE /api/documents/:id
router.delete('/:id', documentController.deleteDocument);

module.exports = router;