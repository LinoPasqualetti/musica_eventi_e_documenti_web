const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const documentController = require('../controllers/documentController');

// Configurazione multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '_' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.get('/song/:songId', documentController.getDocumentsBySong);
router.get('/:id', documentController.getDocument);
router.get('/:id/view', documentController.viewDocument);
router.get('/:id/content', documentController.getDocumentContent);
router.post('/song/:songId', upload.single('file'), documentController.uploadDocument);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;