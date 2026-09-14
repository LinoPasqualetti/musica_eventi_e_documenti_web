/**
 * Controller per la gestione delle registrazioni utenti agli eventi.
 *
 * Ciclo di vita dello status:
 *   pending   -> exported  (script export)
 *   exported  -> imported  (script import sul desktop)
 *   imported  -> validated | rejected  (admin, sul desktop)
 *   validated -> published  (script publish)
 *   rejected  -> published  (script publish)
 */

const crypto = require('crypto');
const { Registration, Event } = require('../models');

/**
 * Genera un ID univoco basato su timestamp + random
 * (stesso stile degli altri ID del progetto)
 */
function generaId() {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

/**
 * POST /api/registrations
 * Crea una nuova registrazione (utente si iscrive)
 */
exports.createRegistration = async (req, res, next) => {
  try {
    const {
      event_id,
      user_id,
      instrument_choice,
      reading_level,
      improvisation_level,
      selected_song_ids,
      notes
    } = req.body;

    if (!event_id || !user_id) {
      const err = new Error('event_id e user_id sono obbligatori');
      err.status = 400;
      return next(err);
    }

    // Verifica che l'evento esista
    const evento = await Event.findByPk(event_id);
    if (!evento) {
      const err = new Error(`Evento ${event_id} non trovato`);
      err.status = 404;
      return next(err);
    }

    const now = new Date().toISOString();
    const registration = await Registration.create({
      id: generaId(),
      event_id,
      user_id,
      status: 'pending',
      instrument_choice: instrument_choice || null,
      reading_level: reading_level || 1,
      improvisation_level: improvisation_level || 1,
      selected_song_ids: Array.isArray(selected_song_ids)
        ? selected_song_ids.join(',')
        : (selected_song_ids || null),
      notes: notes || null,
      created_at: now
    });

    res.status(201).json(registration);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations
 * Elenco registrazioni, con filtri opzionali.
 * Query params: ?status=pending&event_id=xxx&user_id=yyy
 */
exports.getRegistrations = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status)   where.status   = req.query.status;
    if (req.query.event_id) where.event_id = req.query.event_id;
    if (req.query.user_id)  where.user_id  = req.query.user_id;

    const registrations = await Registration.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    res.json(registrations);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/:id
 */
exports.getRegistrationById = async (req, res, next) => {
  try {
    const registration = await Registration.findByPk(req.params.id);
    if (!registration) {
      const err = new Error(`Registration ${req.params.id} non trovata`);
      err.status = 404;
      return next(err);
    }
    res.json(registration);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/registrations/:id/status
 * Aggiorna lo status (usato da admin e dagli script di sync).
 * Body: { status, admin_notes?, confirmed_at?, cancelled_at? }
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, admin_notes, confirmed_at, cancelled_at } = req.body;

    const validStatus = ['pending', 'exported', 'imported', 'validated', 'rejected', 'published'];
    if (!status || !validStatus.includes(status)) {
      const err = new Error(`Status non valido. Valori ammessi: ${validStatus.join(', ')}`);
      err.status = 400;
      return next(err);
    }

    const registration = await Registration.findByPk(req.params.id);
    if (!registration) {
      const err = new Error(`Registration ${req.params.id} non trovata`);
      err.status = 404;
      return next(err);
    }

    registration.status = status;
    if (admin_notes !== undefined) registration.admin_notes = admin_notes;
    if (confirmed_at !== undefined) registration.confirmed_at = confirmed_at;
    if (cancelled_at !== undefined) registration.cancelled_at = cancelled_at;
    registration.updated_at = new Date().toISOString();

    await registration.save();
    res.json(registration);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/registrations/mark-exported
 * Segna come 'exported' un batch di registrazioni.
 * Body: { ids: [id1, id2, ...] }
 */
exports.markExported = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      const err = new Error('ids deve essere un array non vuoto');
      err.status = 400;
      return next(err);
    }

    const now = new Date().toISOString();
    const [updated] = await Registration.update(
      { status: 'exported', updated_at: now },
      { where: { id: ids, status: 'pending' } }
    );

    res.json({ updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/registrations/mark-published
 * Segna come 'published' un batch di registrazioni.
 * Body: { ids: [id1, id2, ...] }
 */
exports.markPublished = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      const err = new Error('ids deve essere un array non vuoto');
      err.status = 400;
      return next(err);
    }

    const now = new Date().toISOString();
    const [updated] = await Registration.update(
      { status: 'published', updated_at: now },
      { where: { id: ids, status: ['validated', 'rejected'] } }
    );

    res.json({ updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/registrations/:id
 */
exports.deleteRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findByPk(req.params.id);
    if (!registration) {
      const err = new Error(`Registration ${req.params.id} non trovata`);
      err.status = 404;
      return next(err);
    }
    await registration.destroy();
    res.json({ deleted: true, id: req.params.id });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/stats
 * Statistiche: quanti record per status, per event_id, ecc.
 */
exports.getStats = async (req, res, next) => {
  try {
    const all = await Registration.findAll();
    const byStatus = {};
    const byEvent = {};

    all.forEach(r => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byEvent[r.event_id] = (byEvent[r.event_id] || 0) + 1;
    });

    res.json({
      total: all.length,
      byStatus,
      byEvent
    });
  } catch (error) {
    next(error);
  }
};
