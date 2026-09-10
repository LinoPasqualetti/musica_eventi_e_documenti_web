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
exports.getDocumentContent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await Document.findByPk(id);

    if (!document) {
      const err = new Error(`Document ${id} not found`);
      err.status = 404;
      return next(err);
    }

    const filePath = path.join(__dirname, '../../uploads', document.file_name);

    if (!fs.existsSync(filePath)) {
      const err = new Error(`File ${document.file_name} not found on disk`);
      err.status = 404;
      return next(err);
    }

    logger.debug('Serving document content', {
      correlationId: req.correlationId,
      documentId: id,
      filename: document.file_name
    });

    // Content-Type dal DB (mime_type) o dedotto dal doc_type
    let contentType = document.mime_type || 'application/octet-stream';
    if (!document.mime_type) {
      if (document.doc_type === 'abc') contentType = 'text/vnd.abc';
      else if (document.doc_type === 'pdf') contentType = 'application/pdf';
      else if (document.doc_type === 'mxl') contentType = 'application/vnd.recordare.musicxml';
      else if (document.doc_type === 'mp3') contentType = 'audio/mpeg';
      else if (document.doc_type === 'mid') contentType = 'audio/midi';
      else if (document.doc_type === 'kar') contentType = 'audio/midi';
      else if (document.doc_type === 'txt') contentType = 'text/plain';
      else if (document.doc_type === 'json') contentType = 'application/json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${document.file_name}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

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