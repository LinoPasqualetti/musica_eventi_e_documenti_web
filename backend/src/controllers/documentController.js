/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\controllers\documentController.js
 *
 * 📝 DESCRIZIONE: Controller per la gestione dei documenti
 * - CRUD completo per documenti
 * - Recupero documenti tramite relazione SongDocument (many-to-many)
 * - Streaming del contenuto dei file
 * - Upload con multer
 * - Sync dal desktop Flutter (BLOB base64 + multipart per file grandi)
 */

// ✅ Importiamo tutti i modelli necessari (incluso Song e SongDocument per la relazione)
const { Song, Document, SongDocument } = require('../models');
const logger = require('../config/logger');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('../config/paths');

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

    const song = await Song.findByPk(songId);
    if (!song) {
      const err = new Error(`Song ${songId} not found`);
      err.status = 404;
      return next(err);
    }

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
 * - Priorità 1: BLOB dal DB (colonna `content`)
 * - Priorità 2: filesystem (UPLOADS_DIR + basename(file_path))
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
      buffer = Buffer.isBuffer(document.content)
        ? document.content
        : Buffer.from(document.content);
    }

    // ---- 3. Fallback: filesystem ----
    if (!buffer) {
      // Candidati in ordine di priorità:
      // 1. file_path con prefisso '/uploads/' rimosso, unito a UPLOADS_DIR
      // 2. file_path assoluto (solo se è un path Windows/Unix reale)
      // 3. UPLOADS_DIR + '<id>_<basename(file_name)>' (fallback formato nuovo)
      // 4. UPLOADS_DIR + basename(file_name) (fallback formato vecchio)
      const candidates = [];

      if (document.file_path) {
        const filenameFromPath = document.file_path.replace(/^\/uploads\//, '');
        candidates.push(path.join(UPLOADS_DIR, filenameFromPath));

        if (path.isAbsolute(document.file_path)) {
          candidates.push(document.file_path);
        }
      }

      if (document.file_name) {
        candidates.push(path.join(UPLOADS_DIR, `${id}_${path.basename(document.file_name)}`));
        candidates.push(path.join(UPLOADS_DIR, path.basename(document.file_name)));
      }

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
 * Crea un nuovo documento (upload tradizionale dal web)
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

    // Determina il path del file fisico (se storage_mode è remote)
    let filePath = null;

    if (document.file_path) {
      const filenameFromPath = document.file_path.replace(/^\/uploads\//, '');
      const candidate = path.join(UPLOADS_DIR, filenameFromPath);
      if (fs.existsSync(candidate)) {
        filePath = candidate;
      }
    }

    if (!filePath && document.file_name) {
      const fallback = path.join(UPLOADS_DIR, `${id}_${path.basename(document.file_name)}`);
      if (fs.existsSync(fallback)) {
        filePath = fallback;
      }
    }

    if (filePath) {
      fs.unlinkSync(filePath);
      logger.debug('File deleted from disk', {
        correlationId: req.correlationId,
        documentId: id,
        path: filePath
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

// ============================================
// SYNC DAL DESKTOP FLUTTER
// ============================================

/**
 * POST /api/documents/sync
 * Riceve un documento dal desktop come BLOB base64 e lo salva nel DB web.
 * Usato per file piccoli (< 1 MB).
 *
 * Body: {
 *   id, fileName, docType, fileSize, contentBase64,
 *   mimeType?, description?, isPublic?, uploadedBy?,
 *   songIds?: string[]
 * }
 */
exports.syncDocument = async (req, res, next) => {
  try {
    const {
      id,
      fileName,
      docType,
      fileSize,
      contentBase64,
      mimeType,
      description,
      isPublic,
      uploadedBy,
      songIds = [],
    } = req.body;

    if (!id || !fileName || !contentBase64) {
      const err = new Error('id, fileName e contentBase64 sono obbligatori');
      err.status = 400;
      return next(err);
    }

    const content = Buffer.from(contentBase64, 'base64');
    const now = new Date().toISOString();

    const existing = await Document.findByPk(id);
    if (existing) {
      existing.file_name = fileName;
      existing.doc_type = docType || existing.doc_type;
      existing.storage_mode = 'blob';
      existing.content = content;
      existing.file_size = fileSize || content.length;
      existing.mime_type = mimeType || existing.mime_type;
      existing.description = description ?? existing.description;
      existing.updated_at = now;
      await existing.save();
    } else {
      await Document.create({
        id,
        doc_type: docType || 'unknown',
        file_name: fileName,
        file_path: `blob:${id}`,
        file_size: fileSize || content.length,
        storage_mode: 'blob',
        content,
        mime_type: mimeType || null,
        description: description || null,
        is_public: isPublic !== undefined ? isPublic : true,
        uploaded_by: uploadedBy || 'desktop',
        created_at: now,
      });
    }

    // Associazioni song_documents
    if (Array.isArray(songIds) && songIds.length > 0) {
      await SongDocument.destroy({ where: { document_id: id } });
      for (const songId of songIds) {
        await SongDocument.create({
          id: `sd_${id}_${songId}`,
          document_id: id,
          song_id: songId,
          order_index: 0,
          created_at: now,
        });
      }
    }

    logger.info('Document synced from desktop', {
      correlationId: req.correlationId,
      documentId: id,
      size: content.length,
      mode: 'blob'
    });

    res.json({ ok: true, id, size: content.length, mode: 'blob' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/documents/upload-big
 * Riceve un file grande via multipart e lo salva in UPLOADS_DIR.
 * Usato per file grandi (>= 1 MB).
 *
 * Body multipart: file + { id, docType, songIds?, uploadedBy?, description?, isPublic? }
 */
exports.uploadBigDocument = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      const err = new Error('File obbligatorio');
      err.status = 400;
      return next(err);
    }

    const {
      id,
      docType,
      songIds,
      uploadedBy = 'desktop',
      description,
      isPublic,
    } = req.body;

    if (!id) {
      const err = new Error('id obbligatorio nel body multipart');
      err.status = 400;
      return next(err);
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destFilename = `${id}_${safeName}`;
    const destPath = path.join(UPLOADS_DIR, destFilename);

    fs.writeFileSync(destPath, file.buffer);

    const publicPath = `/uploads/${destFilename}`;
    const now = new Date().toISOString();

    const existing = await Document.findByPk(id);
    if (existing) {
      existing.file_name = file.originalname;
      existing.doc_type = docType || existing.doc_type;
      existing.storage_mode = 'remote';
      existing.file_path = publicPath;
      existing.file_size = file.size;
      existing.content = null;
      existing.mime_type = file.mimetype || existing.mime_type;
      existing.updated_at = now;
      await existing.save();
    } else {
      await Document.create({
        id,
        doc_type: docType || 'unknown',
        file_name: file.originalname,
        file_path: publicPath,
        file_size: file.size,
        storage_mode: 'remote',
        content: null,
        mime_type: file.mimetype || null,
        description: description || null,
        is_public: isPublic !== undefined ? (isPublic === 'true' || isPublic === true) : true,
        uploaded_by: uploadedBy,
        created_at: now,
      });
    }

    // Associazioni song_documents
    const songIdsArr = typeof songIds === 'string' ? JSON.parse(songIds) : (songIds || []);
    if (Array.isArray(songIdsArr) && songIdsArr.length > 0) {
      await SongDocument.destroy({ where: { document_id: id } });
      for (const songId of songIdsArr) {
        await SongDocument.create({
          id: `sd_${id}_${songId}`,
          document_id: id,
          song_id: songId,
          order_index: 0,
          created_at: now,
        });
      }
    }

    logger.info('Big document uploaded from desktop', {
      correlationId: req.correlationId,
      documentId: id,
      filename: destFilename,
      size: file.size,
    });

    res.json({
      ok: true,
      id,
      size: file.size,
      mode: 'remote',
      url: publicPath,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/documents
 * Lista di tutti i documenti (solo metadati, senza content).
 *
 * Query: ?doc_type=...&storage_mode=...&limit=...&offset=...
 */
exports.getAllDocuments = async (req, res, next) => {
  try {
    const { doc_type, storage_mode, limit = 500, offset = 0 } = req.query;

    const where = {};
    if (doc_type) where.doc_type = doc_type;
    if (storage_mode) where.storage_mode = storage_mode;

    const documents = await Document.findAll({
      where,
      attributes: { exclude: ['content'] },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    logger.debug(`getAllDocuments: ${documents.length} documenti`, {
      correlationId: req.correlationId,
    });

    res.json(documents);
  } catch (error) {
    next(error);
  }
};