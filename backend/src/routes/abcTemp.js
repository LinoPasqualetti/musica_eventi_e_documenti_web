// [NUOVO] C:\musica_eventi_e_documenti_web\backend\src\routes\abcTemp.js

/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\routes\abcTemp.js
 *
 * 📝 DESCRIZIONE:
 * Route per lo storage temporaneo di contenuti ABC generati dal desktop Flutter.
 * Il desktop fa POST con l'ABC, riceve un id, poi apre /viewer?id=... nel browser.
 * Gli ABC scadono dopo 1 ora (TTL in memoria).
 *
 * ⚠️ LIMITE: storage in-memory, funziona con una singola istanza.
 *    Se in futuro si scala a più istanze, migrare a SQLite (tabella abc_temp).
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../config/logger');

const TTL_MS = 60 * 60 * 1000; // 1 ora

// Storage in-memory: id -> { abc, fileName, createdAt }
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
    logger.debug(`🧹 abcTemp cleanup: rimossi ${removed} record scaduti`);
  }
}

/**
 * POST /api/abc-temp
 * Body: { abc: string, fileName?: string }
 * Ritorna: { id: string }
 */
router.post('/', (req, res) => {
  cleanup();

  const { abc, fileName } = req.body || {};

  if (!abc || typeof abc !== 'string' || abc.trim().length === 0) {
    return res.status(400).json({ error: 'abc obbligatorio e non vuoto' });
  }

  // Limite di sicurezza: 5 MB di ABC (molto più del necessario)
  if (abc.length > 5 * 1024 * 1024) {
    return res.status(413).json({ error: 'ABC troppo grande (max 5 MB)' });
  }

  const id = 'abc_' + crypto.randomBytes(12).toString('hex');
  store.set(id, {
    abc,
    fileName: fileName || 'spartito',
    createdAt: Date.now(),
  });

  logger.info(`📥 abcTemp creato: ${id} (${abc.length} caratteri, file="${fileName || 'spartito'}")`);

  res.json({ id });
});

/**
 * GET /api/abc-temp/:id
 * Ritorna: { abc: string, fileName: string }
 * Il record NON viene cancellato dopo la lettura (potrebbe essere ricaricato
 * dalla stessa pagina /viewer); scade per TTL.
 */
router.get('/:id', (req, res) => {
  cleanup();

  const entry = store.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'ABC non trovato o scaduto' });
  }

  res.json({
    abc: entry.abc,
    fileName: entry.fileName,
  });
});

module.exports = router;