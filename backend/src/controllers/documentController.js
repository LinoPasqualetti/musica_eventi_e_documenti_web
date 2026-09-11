/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\controllers\documentController.js
 *
 * 📝 DESCRIZIONE: Controller per la gestione dei documenti
 * - CRUD completo per documenti
 * - Recupero documenti tramite relazione SongDocument (many-to-many)
 * - Streaming del contenuto dei file
 * - Upload con multer
 */

// ✅ Importiamo tutti i modelli necessari (incluso Song e SongDocument per la relazione)
const { Song, Document, SongDocument } = require('../models');
const logger = require('../config/logger');
const path = require('path');
const fs = require('fs');

/**
 * Ottieni tutti i documenti di una canzone (tramite la tabella ponte SongDocument)
 */
exports.getDocumentsBySong = async (req, res, next) => {
  try {
    const { songId } = req.params;

    logger.debug('Getting documents for song', {
      correlationId: req.correlationId,
      songId
    });

    // ✅ Verifica che la canzone esista
    const song = await Song.findByPk(songId);
    if (!song) {
      const err = new Error(`Song ${songId} not found`);
      err.status = 404;
      return next(err);
    }

    // ✅ Usa la relazione belongsToMany (Song ↔ Document tramite SongDocument)
    const songWithDocs = await Song.findByPk(songId, {
      include: [
        {
          model: Document,
          as: 'documents',
          through: {
            model: SongDocument,
            attributes: ['order_index', 'notes']
          },
          required: false
        }
      ]
    });

    const documents = songWithDocs?.documents || [];

    logger.info(`Found ${documents.length} documents for song ${songId}`, {
      correlationId: req.correlationId,
      songId,
      count: documents.length
    });

    res.json(documents);
  } catch (error) {
    logger.error('Error loading song documents', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Ottieni un documento specifico
 */
exports.getDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await Document.findByPk(id);

    if (!document) {
      const err = new Error(`Document ${id} not found`);
      err.status = 404;
      return next(err);
    }

    logger.debug('Document retrieved', {
      correlationId: req.correlationId,
      documentId: id,
      type: document.doc_type
    });

    res.json(document);
  } catch (error) {
    next(error);
  }
};

/**
 * Visualizza un documento (metadati + URL del contenuto)
 */
exports.viewDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await Document.findByPk(id);

    if (!document) {
      const err = new Error(`Document ${id} not found`);
      err.status = 404;
      return next(err);
    }

    logger.info('Document viewed', {
      correlationId: req.correlationId,
      documentId: id,
      type: document.doc_type,
      filename: document.file_name
    });

    res.json({
      id: document.id,
      type: document.doc_type,
      filename: document.file_name,
      title: document.description || document.file_name,
      contentUrl: `/api/documents/${id}/content`,
      size: document.file_size || null,
      mimeType: document.mime_type || null,
      uploadedAt: document.created_at
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ottieni il contenuto grezzo di un documento (streaming)
 */
/**
 * Ottieni il contenuto grezzo di un documento (streaming)
 * - Priorità 1: BLOB dal DB (colonna `content`)
 * - Priorità 2: filesystem (uploads/ oppure file_path originale)
 * - Supporto Range requests per audio/MIDI (seek nel browser)
 */
exports.getDocumentContent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await Document.findByPk(id);

    if (!document) {
      const err = new Error(`Document ${id} not found`);
      err.status = 404;
      return next(err);
    }

    // ---- 1. Determina Content-Type ----
    const contentType = resolveContentType(document);

    // ---- 2. Prova prima il BLOB dal DB ----
    let buffer = null;

    if (document.content) {
      // Sequelize restituisce Buffer (SQLite) o stringa base64 (a seconda del driver)
      buffer = Buffer.isBuffer(document.content)
        ? document.content
        : Buffer.from(document.content);
    }

    // ---- 3. Fallback: filesystem ----
    if (!buffer) {
      const candidates = [
        path.join(__dirname, '../../uploads', document.file_name),
        document.file_path, // percorso originale (es. C:\musica_eventi_e_documenti\...)
        path.join(__dirname, '../../uploads', path.basename(document.file_name || ''))
      ].filter(Boolean);

      for (const p of candidates) {
        try {
          if (fs.existsSync(p)) {
            buffer = fs.readFileSync(p);
            logger.debug('Serving from filesystem', {
              correlationId: req.correlationId,
              documentId: id,
              path: p
            });
            break;
          }
        } catch (_) { /* ignora */ }
      }
    }

    if (!buffer) {
      const err = new Error(`Content for document ${id} not available (no BLOB, no file on disk)`);
      err.status = 404;
      return next(err);
    }

    logger.debug('Serving document content', {
      correlationId: req.correlationId,
      documentId: id,
      filename: document.file_name,
      type: document.doc_type,
      bytes: buffer.length,
      source: document.content ? 'blob' : 'filesystem'
    });

    // ---- 4. Gestione Range (audio/MIDI seek) ----
    const total = buffer.length;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition',
      `inline; filename="${encodeURIComponent(document.file_name || 'document')}"`);

    if (range) {
      // Formato: "bytes=start-end"
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : total - 1;

        if (isNaN(start) || isNaN(end) || start > end || end >= total) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
          return;
        }

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);
        res.end(buffer.slice(start, end + 1));
        return;
      }
    }

    res.setHeader('Content-Length', total);
    res.end(buffer);

  } catch (error) {
    next(error);
  }
};

/**
 * Mappa doc_type + estensione → Content-Type
 */
function resolveContentType(document) {
  if (document.mime_type) return document.mime_type;

  const ext = (document.file_name || '').split('.').pop().toLowerCase();
  const byExt = {
    pdf:  'application/pdf',
    mxl:  'application/vnd.recordare.musicxml',
    xml:  'application/vnd.recordare.musicxml',
    musicxml: 'application/vnd.recordare.musicxml',
    abc:  'text/vnd.abc',
    mid:  'audio/midi',
    midi: 'audio/midi',
    kar:  'audio/midi',
    mp3:  'audio/mpeg',
    wav:  'audio/wav',
    ogg:  'audio/ogg',
    m4a:  'audio/mp4',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    png:  'image/png',
    gif:  'image/gif',
    svg:  'image/svg+xml',
    webp: 'image/webp',
    txt:  'text/plain; charset=utf-8',
    json: 'application/json',
    zip:  'application/zip'
  };

  if (byExt[ext]) return byExt[ext];

  // Fallback per doc_type "logici"
  const byType = {
    audio_mp3: 'audio/mpeg',
    audio_wav: 'audio/wav',
    image:     'image/jpeg',
    pdf:       'application/pdf',
    mid:       'audio/midi',
    kar:       'audio/midi',
    mxl:       'application/vnd.recordare.musicxml',
    abc:       'text/vnd.abc'
  };

  return byType[document.doc_type] || 'application/octet-stream';
}

/**
 * Crea un nuovo documento (upload)
 */
exports.uploadDocument = async (req, res, next) => {
  try {
    const { songId } = req.params;
    const { title, type } = req.body;
    const file = req.file;

    if (!file) {
      const err = new Error('No file uploaded');
      err.status = 400;
      return next(err);
    }

    const document = await Document.create({
      songId,
      filename: file.filename,
      originalName: file.originalname,
      type: type || path.extname(file.originalname).substring(1),
      title: title || file.originalname,
      size: file.size,
      path: file.path
    });

    logger.info('Document uploaded', {
      correlationId: req.correlationId,
      documentId: document.id,
      songId,
      filename: file.filename
    });

    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina un documento
 */
exports.deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await Document.findByPk(id);

    if (!document) {
      const err = new Error(`Document ${id} not found`);
      err.status = 404;
      return next(err);
    }

    const filePath = path.join(__dirname, '../../uploads', document.file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug('File deleted from disk', {
        correlationId: req.correlationId,
        documentId: id,
        filename: document.file_name
      });
    }

    await document.destroy();

    logger.info('Document deleted', {
      correlationId: req.correlationId,
      documentId: id,
      filename: document.file_name
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
};