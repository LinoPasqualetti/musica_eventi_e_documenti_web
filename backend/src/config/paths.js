// [NUOVO] C:\musica_eventi_e_documenti_web\backend\src\config\paths.js

/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\config\paths.js
 *
 * 📝 DESCRIZIONE:
 * Centralizza i path dei file/directory usati dal backend, con distinzione
 * automatica tra development e production.
 *
 * In development:
 *   - UPLOADS_DIR = backend/data/uploads/  (persistente in locale)
 * In production (Fly.io, Hetzner):
 *   - UPLOADS_DIR = /data/uploads/         (volume persistente)
 */

const path = require('path');
const fs = require('fs');

const isProd = process.env.NODE_ENV === 'production';

// In produzione il volume persistente è montato su /data/
// In locale usiamo backend/data/uploads/
const UPLOADS_DIR = isProd
  ? '/data/uploads'
  : path.join(__dirname, '..', '..', 'data', 'uploads');

// Crea la directory se non esiste
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`📁 Creata cartella uploads: ${UPLOADS_DIR}`);
}

module.exports = {
  UPLOADS_DIR,
  isProd,
};