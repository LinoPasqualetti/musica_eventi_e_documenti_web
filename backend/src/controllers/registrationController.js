/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\controllers\registrationController.js
 *
 * 📝 DESCRIZIONE: Controller per la gestione delle candidature (registrations)
 *
 * 🔧 FIX APPLICATE:
 * - 2026-09-24: Ricava event_id dalla catena organ_slot → organ → event_song,
 *               supporto guest, findOrCreate utente guest, status validi,
 *               rimosse markExported/markPublished, created_at esplicito
 * - 2026-09-25: Coerenza di stato:
 *               * deleteRegistration aggiorna anche status='cancelled' + cancelled_at
 *               * updateStatus quando status='cancelled' imposta anche deleted_at
 */

const { Registration, User, OrganSlot, Organ, EventSong, Event, Song } = require('../models');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// Status validi secondo il modello
const VALID_STATUSES = ['pending', 'waitlist', 'confirmed', 'rejected', 'cancelled'];

/**
 * 🔑 HELPER: Ricava event_id e song_id da un organ_slot_id
 * Catena: organ_slot → organ → event_song → { event_id, song_id }
 */
async function resolveEventInfoFromOrganSlot(organSlotId) {
  const organSlot = await OrganSlot.findByPk(organSlotId, {
    include: [
      {
        model: Organ,
        as: 'organ',
        required: true,
        include: [
          {
            model: EventSong,
            as: 'eventSong',
            required: true,
          },
        ],
      },
    ],
  });

  if (!organSlot) {
    return { error: `Organ slot "${organSlotId}" non trovato`, status: 404 };
  }
  if (!organSlot.organ) {
    return { error: `Organ collegato allo slot "${organSlotId}" non trovato`, status: 404 };
  }
  if (!organSlot.organ.eventSong) {
    return { error: `EventSong collegato all'organ "${organSlot.organ.id}" non trovato`, status: 404 };
  }

  return {
    organSlot,
    organ: organSlot.organ,
    eventSong: organSlot.organ.eventSong,
    event_id: organSlot.organ.eventSong.event_id,
    song_id: organSlot.organ.eventSong.song_id,
  };
}

/**
 * POST /api/registrations
 * Crea una nuova candidatura (utente autenticato o guest).
 */
exports.createRegistration = async (req, res, next) => {
  try {
    const {
      organ_slot_id,
      candidate_name,
      candidate_email,
      time_description,
      notes,
      // Accetta anche camelCase
      organSlotId,
      candidateName,
      candidateEmail,
      timeDescription,
    } = req.body;

    const finalOrganSlotId = organ_slot_id || organSlotId;
    const finalCandidateName = candidate_name || candidateName;
    const finalCandidateEmail = candidate_email || candidateEmail;
    const finalTimeDescription = time_description || timeDescription;

    // 🔑 Validazione campi obbligatori
    if (!finalOrganSlotId) {
      const err = new Error('organ_slot_id è obbligatorio');
      err.status = 400;
      return next(err);
    }
    // time_description è opzionale: default "Tutto il brano"

    // 🔑 Ricava event_id/song_id dallo slot (OBBLIGATORIO perché event_id è NOT NULL)
    const resolved = await resolveEventInfoFromOrganSlot(finalOrganSlotId);
    if (resolved.error) {
      const err = new Error(resolved.error);
      err.status = resolved.status;
      return next(err);
    }

    const { event_id, song_id, organSlot } = resolved;

    // 🔑 Determina user_id e dati candidato
    let userId = req.user ? req.user.id : null;
    let resolvedCandidateName = finalCandidateName;
    let resolvedCandidateEmail = finalCandidateEmail;

    if (userId) {
      // Caso 1: Utente autenticato
      const user = await User.findByPk(userId);
      if (!user) {
        const err = new Error(`Utente autenticato ${userId} non trovato`);
        err.status = 404;
        return next(err);
      }
      resolvedCandidateName = resolvedCandidateName || user.full_name;
      resolvedCandidateEmail = resolvedCandidateEmail || user.email;

      logger.info('👤 Candidatura da utente autenticato', {
        correlationId: req.correlationId,
        userId,
        organSlotId: finalOrganSlotId,
        eventId: event_id,
      });
    } else {
      // Caso 2: Utente guest
      if (!finalCandidateName || !finalCandidateEmail) {
        const err = new Error(
          'Per candidarsi senza account, "candidate_name" e "candidate_email" sono obbligatori'
        );
        err.status = 400;
        return next(err);
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalCandidateEmail)) {
        const err = new Error('Formato email non valido');
        err.status = 400;
        return next(err);
      }

      // Trova o crea utente guest
      let guestUser = await User.findOne({ where: { email: finalCandidateEmail } });

      if (!guestUser) {
        const now = new Date().toISOString();

        const bcrypt = require('bcryptjs');
        const randomPassword = uuidv4() + uuidv4();
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        guestUser = await User.create({
          id: uuidv4(),
          email: finalCandidateEmail,
          full_name: finalCandidateName,
          password_hash: passwordHash,
          role: 'user',
          status: 'active',
          created_at: now,
          updated_at: now,
        });

        logger.info('👤 Nuovo utente guest creato (role=user, password random)', {
          correlationId: req.correlationId,
          email: finalCandidateEmail,
          userId: guestUser.id,
        });
      }

      userId = guestUser.id;
      resolvedCandidateName = finalCandidateName;
      resolvedCandidateEmail = finalCandidateEmail;
    }

    // 🔑 Previeni duplicati (stesso utente + stesso slot)
    const existingRegistration = await Registration.findOne({
      where: {
        user_id: userId,
        organ_slot_id: finalOrganSlotId,
      },
    });

    if (existingRegistration) {
      const err = new Error(
        `Esiste già una candidatura per questo slot (id: ${existingRegistration.id})`
      );
      err.status = 409;
      return next(err);
    }

    // 🔑 Crea la candidatura
    const now = new Date().toISOString();
    const registration = await Registration.create({
      id: uuidv4(),
      event_id: event_id,
      user_id: userId,
      song_id: song_id || null,
      organ_slot_id: finalOrganSlotId,
      candidate_name: resolvedCandidateName,
      candidate_email: resolvedCandidateEmail,
      time_description: finalTimeDescription || 'Tutto il brano',
      notes: notes || null,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });

    logger.info('✅ Candidatura creata', {
      correlationId: req.correlationId,
      registrationId: registration.id,
      userId,
      eventId: event_id,
      organSlotId: finalOrganSlotId,
      candidateName: resolvedCandidateName,
    });

    res.status(201).json({
      success: true,
      message: 'Candidatura inviata con successo',
      data: registration,
    });
  } catch (error) {
    logger.error('❌ Errore in createRegistration', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * GET /api/registrations
 * Lista di tutte le candidature (admin).
 */
exports.getAllRegistrations = async (req, res, next) => {
  try {
    const { status, event_id, limit = 500, offset = 0 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (event_id) where.event_id = event_id;

    const registrations = await Registration.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'full_name', 'role'],
          required: false,
        },
        {
          model: Event,
          as: 'event',
          required: false,
        },
        {
          model: OrganSlot,
          as: 'organSlot',
          required: false,
          include: [
            {
              model: Organ,
              as: 'organ',
              required: false,
              include: [
                {
                  model: EventSong,
                  as: 'eventSong',
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    });

    res.json(registrations);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/me
 */
exports.getMyRegistrations = async (req, res, next) => {
  try {
    if (!req.user) {
      const err = new Error('Autenticazione richiesta');
      err.status = 401;
      return next(err);
    }

    const registrations = await Registration.findAll({
      where: {
        user_id: req.user.id,
        deleted_at: null,
      },
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Event,
          as: 'event',
          required: false,
        },
        {
          model: Song,
          as: 'song',
          required: false,
        },
        {
          model: OrganSlot,
          as: 'organSlot',
          required: false,
          include: [
            {
              model: Organ,
              as: 'organ',
              required: false,
              include: [
                {
                  model: EventSong,
                  as: 'eventSong',
                  required: false,
                  include: [
                    { model: Song, as: 'song', required: false },
                    { model: Event, as: 'event', required: false },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    logger.info(`📋 getMyRegistrations: ${registrations.length} candidature per utente ${req.user.id}`, {
      correlationId: req.correlationId,
    });

    res.json(registrations);
  } catch (error) {
    logger.error('❌ Errore in getMyRegistrations', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * GET /api/registrations/stats
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = {};
    for (const s of VALID_STATUSES) {
      stats[s] = await Registration.count({ where: { status: s } });
    }
    stats.total = await Registration.count();

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/:id
 */
exports.getRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findByPk(id, {
      include: [
        { model: User, as: 'user', required: false },
        { model: Event, as: 'event', required: false },
        {
          model: OrganSlot,
          as: 'organSlot',
          required: false,
          include: [
            {
              model: Organ,
              as: 'organ',
              required: false,
              include: [{ model: EventSong, as: 'eventSong', required: false }],
            },
          ],
        },
      ],
    });

    if (!registration) {
      const err = new Error(`Registration ${id} non trovata`);
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
 * Aggiorna lo stato di una candidatura (admin).
 *
 * 🔒 FIX 2026-09-25: quando status='cancelled', imposta anche deleted_at per coerenza
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (!status) {
      const err = new Error('status è obbligatorio');
      err.status = 400;
      return next(err);
    }

    if (!VALID_STATUSES.includes(status)) {
      const err = new Error(
        `status non valido. Valori ammessi: ${VALID_STATUSES.join(', ')}`
      );
      err.status = 400;
      return next(err);
    }

    const registration = await Registration.findByPk(id);

    if (!registration) {
      const err = new Error(`Registration ${id} non trovata`);
      err.status = 404;
      return next(err);
    }

    const now = new Date().toISOString();

    registration.status = status;
    if (admin_notes !== undefined) {
      registration.admin_notes = admin_notes;
    }
    if (status === 'confirmed' && !registration.confirmed_at) {
      registration.confirmed_at = now;
    }
    if (status === 'cancelled') {
      if (!registration.cancelled_at) registration.cancelled_at = now;
      // 🔒 Coerenza: cancelled → deleted_at
      if (!registration.deleted_at) registration.deleted_at = now;
    }
    registration.updated_at = now;
    await registration.save();

    logger.info('✅ Stato candidatura aggiornato', {
      correlationId: req.correlationId,
      registrationId: id,
      newStatus: status,
    });

    res.json(registration);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:eventId/registrations
 * Admin - tutte le candidature di un evento specifico.
 */
exports.getRegistrationsByEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      const err = new Error('eventId è obbligatorio');
      err.status = 400;
      return next(err);
    }

    const registrations = await Registration.findAll({
      where: { event_id: eventId },
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'full_name', 'role'],
          required: false,
        },
        {
          model: Event,
          as: 'event',
          required: false,
        },
        {
          model: OrganSlot,
          as: 'organSlot',
          required: false,
          include: [
            {
              model: Organ,
              as: 'organ',
              required: false,
              include: [
                {
                  model: EventSong,
                  as: 'eventSong',
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    });

    logger.info(`📋 Candidature per evento ${eventId}: ${registrations.length}`, {
      correlationId: req.correlationId,
      eventId,
      count: registrations.length,
    });

    res.json(registrations);
  } catch (error) {
    logger.error('❌ Errore in getRegistrationsByEvent', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// ============================================
// 🔧 FUNZIONI AGGIUNTE (2026-09-24) - Route mancanti
// ============================================

/**
 * GET /api/registrations/slots-availability/:eventSongId
 * Conteggi di disponibilità per ogni slot dell'organico di un evento-canzone.
 */
exports.getSlotsAvailability = async (req, res, next) => {
  try {
    const { eventSongId } = req.params;

    if (!eventSongId) {
      const err = new Error('eventSongId è obbligatorio');
      err.status = 400;
      return next(err);
    }

    const organs = await Organ.findAll({
      where: { event_song_id: eventSongId },
      include: [{ model: OrganSlot, as: 'slots', required: false }],
    });

    if (organs.length === 0) {
      return res.json({ eventSongId, slots: [] });
    }

    const allSlots = [];
    organs.forEach(org => {
      (org.slots || []).forEach(slot => {
        allSlots.push({
          slot_id: slot.id,
          organ_id: slot.organ_id,
          instrument: slot.instrument,
          section: slot.section,
          quantity: slot.quantity,
          order_index: slot.order_index,
        });
      });
    });

    const slotIds = allSlots.map(s => s.slot_id);
    const registrations = await Registration.findAll({
      where: {
        organ_slot_id: { [Op.in]: slotIds },
        status: { [Op.in]: ['pending', 'confirmed'] },
        deleted_at: null,
      },
      attributes: ['organ_slot_id'],
    });

    const countBySlot = {};
    registrations.forEach(r => {
      countBySlot[r.organ_slot_id] = (countBySlot[r.organ_slot_id] || 0) + 1;
    });

    const result = allSlots.map(slot => {
      const registered = countBySlot[slot.slot_id] || 0;
      return {
        ...slot,
        registered,
        available: Math.max(0, slot.quantity - registered),
      };
    });

    logger.debug('getSlotsAvailability', {
      correlationId: req.correlationId,
      eventSongId,
      slots: result.length,
    });

    res.json({ eventSongId, slots: result });
  } catch (error) {
    logger.error('❌ Errore in getSlotsAvailability', {
      correlationId: req.correlationId,
      error: error.message,
    });
    next(error);
  }
};

/**
 * GET /api/registrations (alias)
 */
exports.getRegistrations = async (req, res, next) => {
  return exports.getAllRegistrations(req, res, next);
};

/**
 * GET /api/registrations/:id (alias)
 */
exports.getRegistrationById = async (req, res, next) => {
  return exports.getRegistration(req, res, next);
};

/**
 * DELETE /api/registrations/:id
 * Soft delete (imposta deleted_at). L'utente può cancellare solo le proprie.
 * Admin può cancellare qualsiasi.
 *
 * 🔒 FIX 2026-09-25: aggiorna anche status='cancelled' e cancelled_at
 */
exports.deleteRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findByPk(id);
    if (!registration) {
      const err = new Error(`Registration ${id} non trovata`);
      err.status = 404;
      return next(err);
    }

    // Owner check (solo se autenticato e non admin)
    if (req.user) {
      const isAdmin = req.user.role === 'admin';
      const isOwner = registration.user_id === req.user.id;
      if (!isAdmin && !isOwner) {
        const err = new Error('Non autorizzato a cancellare questa candidatura');
        err.status = 403;
        return next(err);
      }
    }

    const now = new Date().toISOString();

    // 🔒 Soft delete + coerenza di stato
    registration.deleted_at = now;
    registration.status = 'cancelled';
    registration.cancelled_at = now;
    registration.updated_at = now;

    await registration.save();

    logger.info('🗑️ Candidatura cancellata (soft + status=cancelled)', {
      correlationId: req.correlationId,
      registrationId: id,
      byUser: req.user ? req.user.id : 'anonymous',
    });

    res.json({ ok: true, message: 'Candidatura cancellata' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/registrations/mark-exported
 * ⚠️ DEPRECATA: la colonna `exported` non esiste nel DB.
 */
exports.markExported = async (req, res, next) => {
  logger.warn('⚠️ markExported chiamata ma DEPRECATA', {
    correlationId: req.correlationId,
    body: req.body,
  });

  res.json({
    ok: true,
    deprecated: true,
    message: 'Funzionalità deprecata: la colonna exported non esiste più nel DB.',
    count: 0,
  });
};

/**
 * POST /api/registrations/mark-published
 * ⚠️ DEPRECATA: la colonna `published` non esiste nel DB.
 */
exports.markPublished = async (req, res, next) => {
  logger.warn('⚠️ markPublished chiamata ma DEPRECATA', {
    correlationId: req.correlationId,
    body: req.body,
  });

  res.json({
    ok: true,
    deprecated: true,
    message: 'Funzionalità deprecata: la colonna published non esiste più nel DB.',
    count: 0,
  });
};