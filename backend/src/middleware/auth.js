const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.sub, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      return res.status(401).json({ error: 'Utente non trovato' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account non attivo' });
    }

    req.user = user;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token scaduto' });
    }
    return res.status(401).json({ error: 'Token non valido' });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.sub, {
      attributes: { exclude: ['password_hash'] },
    });
    if (user && user.status === 'active') {
      req.user = user;
    }
  } catch (_) {}
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin possono accedere' });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
