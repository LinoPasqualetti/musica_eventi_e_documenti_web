const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const logger = require('../config/logger');

const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function generateId() {
  return `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    status: user.status,
    bio: user.bio,
    profile_picture: user.profile_picture,
    created_at: user.created_at,
    last_login: user.last_login,
  };
}

exports.register = async (req, res, next) => {
  try {
    const { email, password, full_name, bio } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'email, password e full_name sono obbligatori' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri' });
    }
    const emailLower = email.toLowerCase().trim();
    const existing = await User.findOne({ where: { email: emailLower } });
    if (existing) {
      return res.status(409).json({ error: 'Email gia registrata' });
    }
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      id: generateId(),
      email: emailLower,
      password_hash,
      full_name: full_name.trim(),
      role: 'user',
      status: 'active',
      bio: bio || null,
      created_at: nowIso(),
      login_attempts: 0,
    });
    const token = signToken(user);
    logger.info('Utente registrato: ' + user.email, { correlationId: req.correlationId, userId: user.id });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email e password obbligatori' });
    }
    const emailLower = email.toLowerCase().trim();
    const user = await User.findOne({ where: { email: emailLower } });
    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    if (user.locked_until) {
      const lockUntil = new Date(user.locked_until);
      if (lockUntil > new Date()) {
        return res.status(423).json({ error: 'Account temporaneamente bloccato fino a ' + lockUntil.toISOString() });
      }
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account non attivo' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const attempts = (user.login_attempts || 0) + 1;
      const updates = { login_attempts: attempts, updated_at: nowIso() };
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        updates.locked_until = lockUntil.toISOString();
        updates.login_attempts = 0;
      }
      await user.update(updates);
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    await user.update({
      login_attempts: 0,
      locked_until: null,
      last_login: nowIso(),
      updated_at: nowIso(),
    });
    const token = signToken(user);
    logger.info('Login: ' + user.email, { correlationId: req.correlationId, userId: user.id });
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
};

exports.me = async (req, res, next) => {
  try {
    res.json({ user: publicUser(req.user) });
  } catch (e) {
    next(e);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const { full_name, bio, profile_picture } = req.body;
    const updates = { updated_at: nowIso() };
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (bio !== undefined) updates.bio = bio;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture;
    await req.user.update(updates);
    res.json({ user: publicUser(req.user) });
  } catch (e) {
    next(e);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({ error: 'old_password e new_password obbligatori' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'La nuova password deve avere almeno 8 caratteri' });
    }
    const user = await User.findByPk(req.user.id);
    const ok = await bcrypt.compare(old_password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Vecchia password errata' });
    }
    const password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await user.update({ password_hash, updated_at: nowIso() });
    res.json({ message: 'Password aggiornata' });
  } catch (e) {
    next(e);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email obbligatoria' });
    }
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    const genericMessage = 'Se l email e registrata, riceverai le istruzioni per il reset';
    if (!user) {
      return res.json({ message: genericMessage });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.update({
      reset_token: token,
      reset_token_expiry: expiry.toISOString(),
      updated_at: nowIso(),
    });
    logger.info('Reset password richiesto per ' + user.email, { correlationId: req.correlationId, resetToken: token });
    res.json({ message: genericMessage, devToken: process.env.NODE_ENV === 'production' ? undefined : token });
  } catch (e) {
    next(e);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ error: 'token e new_password obbligatori' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri' });
    }
    const user = await User.findOne({ where: { reset_token: token } });
    if (!user || !user.reset_token_expiry) {
      return res.status(400).json({ error: 'Token non valido' });
    }
    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Token scaduto' });
    }
    const password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await user.update({
      password_hash,
      reset_token: null,
      reset_token_expiry: null,
      login_attempts: 0,
      locked_until: null,
      updated_at: nowIso(),
    });
    res.json({ message: 'Password reimpostata con successo' });
  } catch (e) {
    next(e);
  }
};
