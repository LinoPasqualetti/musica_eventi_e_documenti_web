// backend/src/controllers/registrationController.js
/**
 * Controller per la gestione delle registrazioni utenti agli eventi.
 *
 * ─── Ciclo di vita LEGACY (status vecchi) ────────────────────────
 *   pending   -> exported  (script export)
 *   exported  -> imported  (script import sul desktop)
 *   imported  -> validated | rejected  (admin, sul desktop)
 *   validated -> published  (script publish)
 *   rejected  -> published  (script publish)
 *
 * ─── Ciclo di vita NUOVO (organico) ──────────────────────────────
 *   pending   -> confirmed | rejected | waitlist
 *   (gestito su Flutter via sync)
 */

const { Op, fn, col } = require('sequelize');
const { Registration, Event, User, Song, Organ, OrganSlot, EventSong } = require('../models');

/**
 * Genera un ID univoco (vecchio stile numerico).
 */
function generaId() {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

/**
 * Genera un ID per nuove candidature (stile reg_*).
 */
function generateRegId() {
  return `reg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

// ============================================
// FUNZIONI LEGACY (mantenute)
// ============================================

/**
 * POST /api/registrations
 * Crea una nuova registrazione (NUOVO: accetta organ_slot_id + candidate_name).
 * Se il body contiene `organ_slot_id` → modalità "candidatura organico".
 * Se contiene `event_id` + `user_id` → modalità legacy.
 */
exports.createRegistration = async (req, res, next) => {
  try {
    const {
      // Nuovo schema
      organ_slot_id,
      candidate_name,
      candidate_email,
      time_description,
      // Legacy
      event_id,
      user_id,
      instrument_choice,
      reading_level,
      improvisation_level,
      selected_song_ids,
      notes
    } = req.body;

    // ─── Modalità NUOVA (organ_slot_id) ───────────────────────────
    if (organ_slot_id) {
      // L'utente deve essere loggato
      if (!req.user) {
        const err = new Error('Autenticazione richiesta per candidarsi');
        err.status = 401;
        return next(err);
      }

      if (!candidate_name || candidate_name.trim() === '') {
        const err = new Error('candidate_name è obbligatorio');
        err.status = 400;
        return next(err);
      }

      const slot = await OrganSlot.findOne({
        where: { id: organ_slot_id, deleted_at: null },
        include: [
          {
            model: Organ,
            as: 'organ',
            where: { deleted_at: null },
            required: true,
            include: [
              {
                model: EventSong,
                as: 'eventSong',
                required: true,
                attributes: ['id', 'event_id', 'song_id'],
              },
            ],
          },
        ],
      });

      if (!slot) {
        const err = new Error('Slot non trovato o non disponibile');
        err.status = 404;
        return next(err);
      }

      const eventSong = slot.organ.eventSong;

      // Verifica unicità (user_id + candidate_name + organ_slot_id)
      const existing = await Registration.findOne({
        where: {
          user_id: req.user.id,
          candidate_name: candidate_name.trim(),
          organ_slot_id,
          deleted_at: null,
        },
      });

      if (existing) {
        const err = new Error('Esiste già una candidatura con questo nome per questo slot');
        err.status = 409;
        return next(err);
      }

      const registration = await Registration.create({
        id: generateRegId(),
        event_id: eventSong.event_id,
        user_id: req.user.id,
        song_id: eventSong.song_id,
        organ_slot_id,
        candidate_name: candidate_name.trim(),
        candidate_email: candidate_email ? candidate_email.trim() : null,
        time_description: time_description ? time_description.trim() : null,
        notes: notes || null,
        status: 'pending',
        created_at: nowIso(),
        updated_at: nowIso(),
      });

      return res.status(201).json(registration);
    }

    // ─── Modalità LEGACY (event_id + user_id) ─────────────────────
    if (!event_id || !user_id) {
      const err = new Error('event_id e user_id sono obbligatori (o usa organ_slot_id)');
      err.status = 400;
      return next(err);
    }

    const evento = await Event.findByPk(event_id);
    if (!evento) {
      const err = new Error(`Evento ${event_id} non trovato`);
      err.status = 404;
      return next(err);
    }

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
      created_at: nowIso(),
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
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, admin_notes, confirmed_at, cancelled_at } = req.body;

    const validStatus = [
      'pending', 'exported', 'imported', 'validated', 'rejected', 'published',
      'confirmed', 'waitlist', 'cancelled',
    ];
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
    registration.updated_at = nowIso();

    await registration.save();
    res.json(registration);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/registrations/mark-exported
 */
exports.markExported = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      const err = new Error('ids deve essere un array non vuoto');
      err.status = 400;
      return next(err);
    }

    const [updated] = await Registration.update(
      { status: 'exported', updated_at: nowIso() },
      { where: { id: ids, status: 'pending' } }
    );

    res.json({ updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/registrations/mark-published
 */
exports.markPublished = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      const err = new Error('ids deve essere un array non vuoto');
      err.status = 400;
      return next(err);
    }

    const [updated] = await Registration.update(
      { status: 'published', updated_at: nowIso() },
      { where: { id: ids, status: ['validated', 'rejected'] } }
    );

    res.json({ updated });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/stats
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

// ============================================
// FUNZIONI NUOVE (organico)
// ============================================

/**
 * GET /api/registrations/slots-availability/:eventSongId
 * Pubblico - ritorna conteggi aggregati per ogni slot.
 */
exports.getSlotsAvailability = async (req, res, next) => {
  try {
    const { eventSongId } = req.params;

    const eventSong = await EventSong.findByPk(eventSongId, {
      attributes: ['id', 'event_id', 'song_id'],
    });
    if (!eventSong) {
      const err = new Error(`EventSong ${eventSongId} not found`);
      err.status = 404;
      return next(err);
    }

    // Carica organico + slot
    const organ = await Organ.findOne({
      where: { event_song_id: eventSongId, deleted_at: null },
      include: [
        {
          model: OrganSlot,
          as: 'slots',
          where: { deleted_at: null },
          required: false,
        },
      ],
    });

    const slots = organ ? (organ.slots || []) : [];
    const slotIds = slots.map((s) => s.id);

    // Conta candidature per slot/status
    let counts = [];
    if (slotIds.length > 0) {
      counts = await Registration.findAll({
        where: {
          organ_slot_id: { [Op.in]: slotIds },
          deleted_at: null,
        },
        attributes: [
          'organ_slot_id',
          'status',
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['organ_slot_id', 'status'],
        raw: true,
      });
    }

    const bySlot = {};
    for (const c of counts) {
      if (!bySlot[c.organ_slot_id]) {
        bySlot[c.organ_slot_id] = { confirmed: 0, pending: 0, waitlist: 0, rejected: 0 };
      }
      const cnt = parseInt(c.count, 10) || 0;
      if (bySlot[c.organ_slot_id][c.status] !== undefined) {
        bySlot[c.organ_slot_id][c.status] = cnt;
      }
    }

    res.json({
      eventSongId,
      songId: eventSong.song_id,
      slots: slots.map((s) => {
        const c = bySlot[s.id] || { confirmed: 0, pending: 0, waitlist: 0, rejected: 0 };
        const available = Math.max(0, s.quantity - c.confirmed);
        return {
          id: s.id,
          section: s.section,
          instrument: s.instrument,
          quantity: s.quantity,
          notes: s.notes,
          confirmed: c.confirmed,
          pending: c.pending,
          waitlist: c.waitlist,
          available,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/me
 * Autenticato - le candidature dell'utente loggato (nuovo schema).
 */
exports.getMyRegistrations = async (req, res, next) => {
  try {
    if (!req.user) {
      const err = new Error('Autenticazione richiesta');
      err.status = 401;
      return next(err);
    }

    const registrations = await Registration.findAll({
      where: { user_id: req.user.id, deleted_at: null },
      order: [['created_at', 'DESC']],
    });

    res.json({ registrations });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/registrations/:id
 * Soft delete con owner check (sostituisce il vecchio hard delete).
 */
exports.deleteRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findOne({
      where: { id, deleted_at: null },
    });
    if (!registration) {
      const err = new Error(`Registration ${id} non trovata`);
      err.status = 404;
      return next(err);
    }

    // Owner check: solo chi l'ha creata (o admin) può cancellarla
    if (req.user && registration.user_id !== req.user.id && req.user.role !== 'admin') {
      const err = new Error('Non puoi cancellare questa candidatura');
      err.status = 403;
      return next(err);
    }

    // Le candidature confermate/rifiutate non si cancellano
    if (registration.status === 'confirmed' || registration.status === 'rejected') {
      const err = new Error('Non puoi ritirare una candidatura già processata');
      err.status = 400;
      return next(err);
    }

    await registration.update({
      deleted_at: nowIso(),
      updated_at: nowIso(),
    });

    res.json({ deleted: true, id });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:eventId/registrations
 * Admin - tutte le candidature dell'evento (nuovo schema).
 */
exports.getRegistrationsByEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const eventSongs = await EventSong.findAll({
      where: { event_id: eventId },
      attributes: ['song_id'],
      raw: true,
    });

    const songIds = [...new Set(eventSongs.map((es) => es.song_id))];
    if (songIds.length === 0) {
      return res.json({ registrations: [] });
    }

    const registrations = await Registration.findAll({
      where: {
        song_id: { [Op.in]: songIds },
        deleted_at: null,
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'full_name', 'email'] },
        { model: Song, as: 'song', attributes: ['id', 'title', 'composer'] },
        {
          model: OrganSlot,
          as: 'organSlot',
          attributes: ['id', 'section', 'instrument', 'quantity'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({ registrations });
  } catch (error) {
    next(error);
  }
};