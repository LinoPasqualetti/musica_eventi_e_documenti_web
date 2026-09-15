// [NUOVO] C:\musica_eventi_e_documenti_web\backend\src\routes\mxlTemp.js

/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\routes\mxlTemp.js
 *
 * 📝 DESCRIZIONE:
 * Storage temporaneo per file .mxl (bytes binari) caricati dal desktop Flutter.
 * Il desktop fa POST con i bytes, riceve un id, poi apre /mxl-viewer?id=... nel
 * browser. Lì ScoreViewer.jsx decomprime il .mxl, estrae il MusicXML e lo
 * converte in ABC lato browser (con musicxml-io + abcjs).
 *
 * ⚠️ LIMITE: storage in-memory. Funziona con una singola istanza. Se in futuro
 *    si scala a più istanze, migrare a SQLite (tabella mxl_temp).
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../config/logger');

const TTL_MS = 60 * 60 * 1000; // 1 ora
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

// Storage in-memory: id -> { buffer, fileName, createdAt }
const store = new Map();

function cleanup() {
  const now = Date.now();
  let removed = 0;
  for (const [id, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    logger.debug(`🧹 mxlTemp cleanup: rimossi ${removed} record scaduti`);
  }
}

/**
 * POST /api/mxl-temp?fileName=xxx.mxl
 * Body: raw binary (Content-Type: application/octet-stream)
 * Ritorna: { id, fileName, size }
 */
router.post(
  '/',
  express.raw({ type: 'application/octet-stream', limit: '20mb' }),
  (req, res) => {
    cleanup();

    const buffer = req.body;
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      return res.status(400).json({ error: 'corpo vuoto o non binario' });
    }
    if (buffer.length > MAX_SIZE) {
      return res.status(413).json({ error: 'file troppo grande (max 20 MB)' });
    }

    const fileName =
      req.query.fileName ||
      req.headers['x-file-name'] ||
      'spartito.mxl';

    const id = 'mxl_' + crypto.randomBytes(12).toString('hex');
    store.set(id, { buffer, fileName, createdAt: Date.now() });

    logger.info(
      `📥 mxlTemp creato: ${id} (${buffer.length} byte, "${fileName}")`,
    );

    res.json({ id, fileName, size: buffer.length });
  },
);

/**
 * GET /api/mxl-temp/:id/content
 * Serve il binario .mxl originale.
 * ScoreViewer.jsx lo legge via fetch e fa la conversione nel browser.
 */
router.get('/:id/content', (req, res) => {
  cleanup();

  const entry = store.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'MXL non trovato o scaduto' });
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.recordare.musicxml', // MIME ufficiale per .mxl
  );
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${entry.fileName}"`,
  );
  res.setHeader('Content-Length', entry.buffer.length);
  res.send(entry.buffer);
});

/**
 * GET /api/mxl-temp/:id
 * Ritorna metadati.
 */
router.get('/:id', (req, res) => {
  cleanup();

  const entry = store.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'MXL non trovato o scaduto' });
  }

  res.json({
    fileName: entry.fileName,
    size: entry.buffer.length,
    createdAt: new Date(entry.createdAt).toISOString(),
  });
});

module.exports = router;