const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

router.get('/me', requireAuth, authController.me);
router.patch('/me', requireAuth, authController.updateMe);
router.post('/change-password', requireAuth, authController.changePassword);

router.post('/logout', (req, res) => {
  res.json({ message: 'Logout effettuato. Elimina il token dal client.' });
});

module.exports = router;
