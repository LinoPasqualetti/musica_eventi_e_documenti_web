/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\controllers\organController.js
 *
 * 📝 DESCRIZIONE: Controller per organici (Organ) e slot (OrganSlot)
 *
 * 🔧 FIX APPLICATE:
 * - 2026-09-24: Validazione/normalizzazione sezione, riassegnazione order_index,
 *               transazione atomica, created_at esplicito, UUID standard
 * - 2026-09-25 v1: Protezione integrità dati:
 *               * deleteSlot blocca se ci sono candidature attive
 *               * updateSlot blocca se quantity < confirmed
 *               * deleteOrgan blocca se ci sono candidature attive
 * - 2026-09-25 v3: syncOrgan diff-safe:
 *               * diff per id invece di replace atomico
 *               * mantiene collegamenti candidature
 *               * blocco rimozioni con candidature attive
 *               * nuovo endpoint syncBulk (Flutter → Web, bulk non atomico)
 */

const { Organ, OrganSlot, EventSong, Registration } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

// Sezioni valide secondo il modello OrganSlot
const VALID_SECTIONS = ['ritmica', 'armonica', 'solistica', 'orchestrale'];

// Status che contano come "candidatura attiva"
const ACTIVE_REG_STATUSES = ['pending', 'waitlist', 'confirmed'];

/**
 * 🔑 HELPER: Normalizza un valore di sezione
 */
function normalizeSection(rawSection) {
  if (!rawSection) return null;
  const s = String(rawSection).trim().toLowerCase();

  if (VALID_SECTIONS.includes(s)) return s;

  const aliases = {
    'ritmico': 'ritmica',
    'ritmici': 'ritmica',
    'rhythm': 'ritmica',
    'armonico': 'armonica',
    'armonici': 'armonica',
    'harmony': 'armonica',
    'solistico': 'solistica',
    'solisti': 'solistica',
    'solo': 'solistica',
    'orchestra': 'orchestrale',
    'orchestral': 'orchestrale',
  };

  return aliases[s] || null;
}

/**
 * 🔑 HELPER: Valida/normalizza un UUID.
 */
function normalizeUuid(id, fallbackPrefix = 'id') {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (id && uuidRegex.test(id)) return id;
  const newId = uuidv4();
  if (id) {
    logger.warn(`⚠️ ID non valido "${id}" (${fallbackPrefix}). Generato: ${newId}`);
  }
  return newId;
}

/**
 * GET /api/event-songs/:eventSongId/organs
 */
exports.getOrgansByEventSong = async (req, res, next) => {
  try {
    const { eventSongId } = req.params;

    const eventSong = await EventSong.findByPk(eventSongId);
    if (!eventSong) {
      const err = new Error(`EventSong ${eventSongId} non trovato`);
      err.status = 404;
      return next(err);
    }

    const organs = await Organ.findAll({
      where: { event_song_id: eventSongId },
      include: [{ model: OrganSlot, as: 'slots', required: false }],
      order: [
        ['created_at', 'ASC'],
        [{ model: OrganSlot, as: 'slots' }, 'order_index', 'ASC'],
      ],
    });

    res.json(organs);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/organs/:organId
 */
exports.getOrgan = async (req, res, next) => {
  try {
    const { organId } = req.params;

    const organ = await Organ.findByPk(organId, {
      include: [
        { model: OrganSlot, as: 'slots', required: false },
        { model: EventSong, as: 'eventSong', required: false },
      ],
      order: [[{ model: OrganSlot, as: 'slots' }, 'order_index', 'ASC']],
    });

    if (!organ) {
      const err = new Error(`Organ ${organId} non trovato`);
      err.status = 404;
      return next(err);
    }

    res.json(organ);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/event-songs/:eventSongId/organs
 * Body: { name, notes? }
 */
exports.createOrgan = async (req, res, next) => {
  try {
    const { eventSongId } = req.params;
    const { name, notes } = req.body;

    if (!name) {
      const err = new Error('name è obbligatorio');
      err.status = 400;
      return next(err);
    }

    const eventSong = await EventSong.findByPk(eventSongId);
    if (!eventSong) {
      const err = new Error(`EventSong ${eventSongId} non trovato`);
      err.status = 404;
      return next(err);
    }

    const now = new Date().toISOString();
    const organ = await Organ.create({
      id: uuidv4(),
      event_song_id: eventSongId,
      name,
      notes: notes || null,
      created_at: now,
      updated_at: now,
    });

    logger.info('🎹 Organico creato', {
      correlationId: req.correlationId,
      organId: organ.id,
      eventSongId,
    });

    res.status(201).json(organ);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/organs/:organId
 */
exports.updateOrgan = async (req, res, next) => {
  try {
    const { organId } = req.params;
    const { name, notes } = req.body;

    const organ = await Organ.findByPk(organId);
    if (!organ) {
      const err = new Error(`Organ ${organId} non trovato`);
      err.status = 404;
      return next(err);
    }

    if (name !== undefined) organ.name = name;
    if (notes !== undefined) organ.notes = notes;
    organ.updated_at = new Date().toISOString();
    await organ.save();

    res.json(organ);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/organs/:organId
 * 🔒 FIX 2026-09-25: blocca se ci sono candidature attive sui suoi slot
 */
exports.deleteOrgan = async (req, res, next) => {
  try {
    const { organId } = req.params;

    const organ = await Organ.findByPk(organId);
    if (!organ) {
      const err = new Error(`Organ ${organId} non trovato`);
      err.status = 404;
      return next(err);
    }

    // 🔒 Verifica candidature attive su tutti gli slot dell'organo
    const slots = await OrganSlot.findAll({
      where: { organ_id: organId },
      attributes: ['id'],
    });
    const slotIds = slots.map(s => s.id);

    if (slotIds.length > 0) {
      const activeRegs = await Registration.count({
        where: {
          organ_slot_id: { [Op.in]: slotIds },
          status: { [Op.in]: ACTIVE_REG_STATUSES },
          deleted_at: null,
        },
      });

      if (activeRegs > 0) {
        logger.warn('⛔ deleteOrgan bloccato: candidature attive', {
          correlationId: req.correlationId,
          organId,
          activeRegs,
        });
        return res.status(409).json({
          error: `Impossibile eliminare: ${activeRegs} candidature attive sugli slot ` +
                 `di questo organico.`,
          activeRegistrations: activeRegs,
          organId,
        });
      }
    }

    await OrganSlot.destroy({ where: { organ_id: organId } });
    await organ.destroy();

    logger.info('🗑️ Organico eliminato', {
      correlationId: req.correlationId,
      organId,
    });

    res.json({ message: 'Organico eliminato con successo' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/organs/:organId/slots
 * Body: { instrument, section, quantity?, notes? }
 */
exports.createSlot = async (req, res, next) => {
  try {
    const { organId } = req.params;
    const { instrument, section, quantity, notes } = req.body;

    if (!instrument || !section) {
      const err = new Error('instrument e section sono obbligatori');
      err.status = 400;
      return next(err);
    }

    const normalizedSection = normalizeSection(section);
    if (!normalizedSection) {
      const err = new Error(
        `Sezione "${section}" non valida. Valori ammessi: ${VALID_SECTIONS.join(', ')}`
      );
      err.status = 400;
      return next(err);
    }

    const organ = await Organ.findByPk(organId);
    if (!organ) {
      const err = new Error(`Organ ${organId} non trovato`);
      err.status = 404;
      return next(err);
    }

    const maxOrder = await OrganSlot.max('order_index', {
      where: { organ_id: organId },
    });
    const nextOrder = (maxOrder === null || isNaN(maxOrder)) ? 0 : maxOrder + 1;

    const now = new Date().toISOString();
    const slot = await OrganSlot.create({
      id: uuidv4(),
      organ_id: organId,
      instrument,
      section: normalizedSection,
      quantity: quantity || 1,
      notes: notes || null,
      order_index: nextOrder,
      created_at: now,
      updated_at: now,
    });

    logger.info('🎵 Slot aggiunto', {
      correlationId: req.correlationId,
      slotId: slot.id,
      organId,
      instrument,
    });

    res.status(201).json(slot);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/organ-slots/:slotId
 * 🔒 FIX 2026-09-25: blocca se quantity scende sotto le confermate
 */
exports.updateSlot = async (req, res, next) => {
  try {
    const { slotId } = req.params;
    const { instrument, section, quantity, notes, order_index } = req.body;

    const slot = await OrganSlot.findByPk(slotId);
    if (!slot) {
      const err = new Error(`OrganSlot ${slotId} non trovato`);
      err.status = 404;
      return next(err);
    }

    // 🔒 Se si sta riducendo quantity, verifica che non scenda sotto le confermate
    if (quantity !== undefined && quantity < slot.quantity) {
      const confirmedCount = await Registration.count({
        where: {
          organ_slot_id: slotId,
          status: 'confirmed',
          deleted_at: null,
        },
      });

      if (quantity < confirmedCount) {
        logger.warn('⛔ updateSlot bloccato: quantity < confirmed', {
          correlationId: req.correlationId,
          slotId,
          requestedQuantity: quantity,
          confirmedCount,
        });
        return res.status(409).json({
          error: `Quantity non può essere ${quantity}: ci sono già ${confirmedCount} ` +
                 `candidature confermate su questo slot.`,
          confirmedCount,
          requestedQuantity: quantity,
        });
      }
    }

    // 🔒 Warning se cambia section/instrument con candidature attive
    const activeRegs = await Registration.count({
      where: {
        organ_slot_id: slotId,
        status: { [Op.in]: ACTIVE_REG_STATUSES },
        deleted_at: null,
      },
    });

    if (activeRegs > 0) {
      if (instrument !== undefined && instrument !== slot.instrument) {
        logger.warn('⚠️ updateSlot: cambio instrument con candidature attive', {
          correlationId: req.correlationId,
          slotId,
          oldInstrument: slot.instrument,
          newInstrument: instrument,
          activeRegs,
        });
      }
      if (section !== undefined) {
        const normalizedSection = normalizeSection(section);
        if (normalizedSection && normalizedSection !== slot.section) {
          logger.warn('⚠️ updateSlot: cambio section con candidature attive', {
            correlationId: req.correlationId,
            slotId,
            oldSection: slot.section,
            newSection: normalizedSection,
            activeRegs,
          });
        }
      }
    }

    // Applica le modifiche
    if (instrument !== undefined) slot.instrument = instrument;
    if (section !== undefined) {
      const normalizedSection = normalizeSection(section);
      if (!normalizedSection) {
        const err = new Error(
          `Sezione "${section}" non valida. Valori ammessi: ${VALID_SECTIONS.join(', ')}`
        );
        err.status = 400;
        return next(err);
      }
      slot.section = normalizedSection;
    }
    if (quantity !== undefined) slot.quantity = quantity;
    if (notes !== undefined) slot.notes = notes;
    if (order_index !== undefined) slot.order_index = order_index;
    slot.updated_at = new Date().toISOString();
    await slot.save();

    res.json(slot);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/organ-slots/:slotId
 * 🔒 FIX 2026-09-25: blocca se ci sono candidature attive
 */
exports.deleteSlot = async (req, res, next) => {
  try {
    const { slotId } = req.params;

    const slot = await OrganSlot.findByPk(slotId);
    if (!slot) {
      const err = new Error(`OrganSlot ${slotId} non trovato`);
      err.status = 404;
      return next(err);
    }

    // 🔒 Blocca se ci sono candidature attive
    const activeRegs = await Registration.count({
      where: {
        organ_slot_id: slotId,
        status: { [Op.in]: ACTIVE_REG_STATUSES },
        deleted_at: null,
      },
    });

    if (activeRegs > 0) {
      logger.warn('⛔ deleteSlot bloccato: candidature attive', {
        correlationId: req.correlationId,
        slotId,
        activeRegs,
      });
      return res.status(409).json({
        error: `Impossibile eliminare: ${activeRegs} candidature attive su questo slot. ` +
               `Rifiutale o cancellale prima.`,
        activeRegistrations: activeRegs,
        slotId,
      });
    }

    await slot.destroy();

    logger.info('🗑️ Slot eliminato', {
      correlationId: req.correlationId,
      slotId,
    });

    res.json({ message: 'Slot eliminato con successo' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/organs/sync
 * Sincronizza un organico completo dal desktop Flutter.
 * Body: { event_song_id, organ: {id?, name, notes?}, slots: [...] }
 *
 * 🔧 FIX 2026-09-25 v3: DIFF PER ID invece di replace atomico
 * - Slot con id esistente → aggiorna (se cambia)
 * - Slot con id nuovo → crea
 * - Slot presenti in DB ma non nel payload:
 *     * senza candidature → elimina
 *     * con candidature    → BLOCCA (409, rollback totale)
 */
exports.syncOrgan = async (req, res, next) => {
  const transaction = await Organ.sequelize.transaction();

  try {
    const { event_song_id, organ, slots } = req.body;

    if (!event_song_id) {
      const err = new Error('event_song_id è obbligatorio');
      err.status = 400;
      await transaction.rollback();
      return next(err);
    }

    if (!organ || !organ.name) {
      const err = new Error('organ.name è obbligatorio');
      err.status = 400;
      await transaction.rollback();
      return next(err);
    }

    const eventSong = await EventSong.findByPk(event_song_id, { transaction });
    if (!eventSong) {
      const err = new Error(`EventSong "${event_song_id}" non trovato`);
      err.status = 404;
      await transaction.rollback();
      return next(err);
    }

    const now = new Date().toISOString();
    const organId = normalizeUuid(organ.id, 'organ.id');

    const [organRecord, organCreated] = await Organ.findOrCreate({
      where: { id: organId },
      defaults: {
        id: organId,
        event_song_id: event_song_id,
        name: organ.name,
        notes: organ.notes || null,
        created_at: now,
        updated_at: now,
      },
      transaction,
    });

    if (!organCreated) {
      await organRecord.update(
        {
          event_song_id: event_song_id,
          name: organ.name,
          notes: organ.notes || null,
          updated_at: now,
        },
        { transaction }
      );
    }

    logger.info(`🎹 Organico ${organCreated ? 'creato' : 'aggiornato'}`, {
      correlationId: req.correlationId,
      organId,
      eventSongId: event_song_id,
    });

    // ============================================
    // 🔑 DIFF PER ID
    // ============================================

    // 1. Slot attualmente in DB
    const existingSlots = await OrganSlot.findAll({
      where: { organ_id: organId },
      transaction,
    });
    const existingById = new Map(existingSlots.map(s => [s.id, s]));

    // 2. Slot nel payload (normalizzati)
    const sortedSlots = Array.isArray(slots)
      ? [...slots].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      : [];

    const payloadSlotIds = new Set();
    const added = [];
    const modified = [];
    const skipped = [];
    const errors = [];

    // 3. Processa ogni slot del payload
    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];

      if (!slot.instrument || !slot.section) {
        logger.warn(`⚠️ Slot ${i} ignorato: 'instrument' o 'section' mancanti`);
        errors.push({ index: i, reason: 'missing_fields' });
        continue;
      }

      const normalizedSection = normalizeSection(slot.section);
      if (!normalizedSection) {
        logger.warn(`⚠️ Slot ${i} ignorato: sezione non valida`);
        errors.push({ index: i, reason: 'invalid_section' });
        continue;
      }

      const slotId = normalizeUuid(slot.id, `slot[${i}].id`);
      payloadSlotIds.add(slotId);

      if (existingById.has(slotId)) {
        // Slot esistente → aggiorna se cambia
        const existing = existingById.get(slotId);
        const changes = {};

        if (existing.instrument !== slot.instrument) changes.instrument = slot.instrument;
        if (existing.section !== normalizedSection) changes.section = normalizedSection;
        if (existing.quantity !== (slot.quantity || 1)) changes.quantity = slot.quantity || 1;
        if (existing.notes !== (slot.notes || null)) changes.notes = slot.notes || null;
        if (existing.order_index !== i) changes.order_index = i;

        // 🔒 Blocca se sta riducendo quantity sotto le confirmed
        if (changes.quantity !== undefined && changes.quantity < existing.quantity) {
          const confirmedCount = await Registration.count({
            where: {
              organ_slot_id: slotId,
              status: 'confirmed',
              deleted_at: null,
            },
            transaction,
          });
          if (changes.quantity < confirmedCount) {
            errors.push({
              slot_id: slotId,
              reason: 'quantity_below_confirmed',
              confirmedCount,
              requestedQuantity: changes.quantity,
            });
            continue;
          }
        }

        if (Object.keys(changes).length > 0) {
          changes.updated_at = now;
          await existing.update(changes, { transaction });
          modified.push({ slot_id: slotId, changes });
        } else {
          skipped.push({ slot_id: slotId, reason: 'no_changes' });
        }
      } else {
        // Slot nuovo → crea
        const newSlot = await OrganSlot.create(
          {
            id: slotId,
            organ_id: organId,
            instrument: slot.instrument,
            section: normalizedSection,
            quantity: slot.quantity || 1,
            notes: slot.notes || null,
            order_index: i,
            created_at: now,
            updated_at: now,
          },
          { transaction }
        );
        added.push({ slot_id: newSlot.id, instrument: slot.instrument });
      }
    }

    // 4. Slot in DB ma NON nel payload → candidati per rimozione
    const toRemove = existingSlots.filter(s => !payloadSlotIds.has(s.id));

    const removed = [];
    const blockedRemovals = [];

    for (const slot of toRemove) {
      const activeRegs = await Registration.count({
        where: {
          organ_slot_id: slot.id,
          status: { [Op.in]: ACTIVE_REG_STATUSES },
          deleted_at: null,
        },
        transaction,
      });

      if (activeRegs > 0) {
        blockedRemovals.push({
          slot_id: slot.id,
          instrument: slot.instrument,
          activeRegistrations: activeRegs,
        });
      } else {
        await slot.destroy({ transaction });
        removed.push({ slot_id: slot.id, instrument: slot.instrument });
      }
    }

    // 5. Se ci sono blocked removals → rollback totale
    if (blockedRemovals.length > 0) {
      await transaction.rollback();
      logger.warn('⛔ syncOrgan bloccato: slot con candidature attive', {
        correlationId: req.correlationId,
        organId,
        blockedRemovals,
      });
      return res.status(409).json({
        success: false,
        error: 'Impossibile rimuovere slot con candidature attive',
        organ_id: organId,
        blockedRemovals,
      });
    }

    await transaction.commit();

    const result = await Organ.findByPk(organId, {
      include: [{ model: OrganSlot, as: 'slots', required: false }],
      order: [[{ model: OrganSlot, as: 'slots' }, 'order_index', 'ASC']],
    });

    logger.info('✅ syncOrgan completato', {
      correlationId: req.correlationId,
      organId,
      added: added.length,
      modified: modified.length,
      removed: removed.length,
      skipped: skipped.length,
    });

    res.status(200).json({
      success: true,
      message: `Organico ${organCreated ? 'creato' : 'aggiornato'} con successo`,
      data: result,
      stats: {
        created: organCreated,
        slotsAdded: added.length,
        slotsModified: modified.length,
        slotsRemoved: removed.length,
        slotsSkipped: skipped.length,
        errors: errors.length,
      },
      diff: { added, modified, removed, skipped, errors },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('❌ Errore in syncOrgan', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * POST /api/organs/sync-bulk
 * Sync bulk di N organici (Flutter → Web).
 * Body: {
 *   organs: [
 *     { event_song_id, organ: {id?, name, notes?}, slots: [...] },
 *     ...
 *   ]
 * }
 *
 * 🔧 FIX 2026-09-25: bulk NON atomico
 * - Ogni organico è indipendente
 * - Se uno fallisce (blocco, errore), gli altri procedono
 * - Ritorna report per event_song_id
 */
exports.syncBulk = async (req, res, next) => {
  try {
    const { organs } = req.body;

    if (!Array.isArray(organs) || organs.length === 0) {
      const err = new Error('organs deve essere un array non vuoto');
      err.status = 400;
      return next(err);
    }

    if (organs.length > 100) {
      const err = new Error('Massimo 100 organici per batch');
      err.status = 400;
      return next(err);
    }

    const results = [];

    for (const item of organs) {
      const { event_song_id, organ, slots } = item;

      // Validazione minima
      if (!event_song_id || !organ || !organ.name) {
        results.push({
          event_song_id: event_song_id || null,
          status: 'error',
          error: 'missing_fields',
        });
        continue;
      }

      // Chiama syncOrgan in modo "trasparente" per riusare la logica
      try {
        const result = await new Promise((resolve) => {
          const fakeReq = {
            body: { event_song_id, organ, slots },
            correlationId: req.correlationId,
            user: req.user,
          };

          const fakeRes = {
            status: (code) => ({
              json: (data) => {
                resolve({ httpStatus: code, body: data });
              },
            }),
            json: (data) => {
              resolve({ httpStatus: 200, body: data });
            },
          };

          exports.syncOrgan(fakeReq, fakeRes, (err) => {
            resolve({
              httpStatus: err.status || 500,
              body: { success: false, error: err.message },
            });
          });
        });

        results.push({
          event_song_id,
          status: result.httpStatus === 200 ? 'applied' : 'blocked',
          httpStatus: result.httpStatus,
          stats: result.body?.stats || null,
          error: result.body?.error || null,
          blockedRemovals: result.body?.blockedRemovals || null,
        });
      } catch (e) {
        results.push({
          event_song_id,
          status: 'error',
          error: e.message,
        });
      }
    }

    const applied = results.filter(r => r.status === 'applied').length;
    const blocked = results.filter(r => r.status === 'blocked').length;
    const errored = results.filter(r => r.status === 'error').length;

    logger.info(`📦 syncBulk: ${applied} applicati, ${blocked} bloccati, ${errored} errori`, {
      correlationId: req.correlationId,
      total: organs.length,
      applied,
      blocked,
      errored,
    });

    res.status(200).json({
      success: true,
      total: organs.length,
      applied,
      blocked,
      errored,
      results,
    });
  } catch (error) {
    logger.error('❌ Errore in syncBulk', {
      correlationId: req.correlationId,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * GET /api/organs/:organId (alias)
 */
exports.getOrganById = async (req, res, next) => {
  return exports.getOrgan(req, res, next);
};