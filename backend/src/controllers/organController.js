const { Organ, OrganSlot, EventSong } = require('../models');
const { sequelize } = require('../config/database');
const logger = require('../config/logger');

// ============================================
// UTILITÀ
// ============================================

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

const ORGAN_SECTIONS = ['ritmica', 'armonica', 'solistica', 'orchestrale'];

// ============================================
// ORGANICI
// ============================================

/**
 * GET /api/event-songs/:eventSongId/organs
 * Lista organici di un brano-in-un-evento (con slot)
 */
exports.getOrgansByEventSong = async (req, res, next) => {
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

    const organs = await Organ.findAll({
      where: { event_song_id: eventSongId, deleted_at: null },
      include: [
        {
          model: OrganSlot,
          as: 'slots',
          where: { deleted_at: null },
          required: false,
          separate: true,
          order: [
            [sequelize.literal(`CASE section
              WHEN 'ritmica' THEN 1
              WHEN 'armonica' THEN 2
              WHEN 'solistica' THEN 3
              WHEN 'orchestrale' THEN 4
              ELSE 5 END`), 'ASC'],
            ['order_index', 'ASC'],
          ],
        },
      ],
      order: [['created_at', 'ASC']],
    });

    logger.debug(`Organici per eventSong ${eventSongId}: ${organs.length}`, {
      correlationId: req.correlationId,
      eventSongId,
    });

    res.json(organs);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/event-songs/:eventSongId/organs
 * Crea nuovo organico
 */
exports.createOrgan = async (req, res, next) => {
  try {
    const { eventSongId } = req.params;
    const { name, notes } = req.body;

    const eventSong = await EventSong.findByPk(eventSongId, {
      attributes: ['id'],
    });
    if (!eventSong) {
      const err = new Error(`EventSong ${eventSongId} not found`);
      err.status = 404;
      return next(err);
    }

    const organ = await Organ.create({
      id: generateId('org'),
      event_song_id: eventSongId,
      name: name || 'Organico standard',
      notes: notes || null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    logger.info(`Organico creato: ${organ.id}`, {
      correlationId: req.correlationId,
      eventSongId,
    });

    res.status(201).json(organ);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/organs/:organId
 */
exports.getOrganById = async (req, res, next) => {
  try {
    const { organId } = req.params;

    const organ = await Organ.findOne({
      where: { id: organId, deleted_at: null },
      include: [
        {
          model: OrganSlot,
          as: 'slots',
          where: { deleted_at: null },
          required: false,
          separate: true,
          order: [
            [sequelize.literal(`CASE section
              WHEN 'ritmica' THEN 1
              WHEN 'armonica' THEN 2
              WHEN 'solistica' THEN 3
              WHEN 'orchestrale' THEN 4
              ELSE 5 END`), 'ASC'],
            ['order_index', 'ASC'],
          ],
        },
      ],
    });

    if (!organ) {
      const err = new Error(`Organ ${organId} not found`);
      err.status = 404;
      return next(err);
    }

    res.json(organ);
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

    const organ = await Organ.findOne({
      where: { id: organId, deleted_at: null },
    });
    if (!organ) {
      const err = new Error(`Organ ${organId} not found`);
      err.status = 404;
      return next(err);
    }

    if (name !== undefined) organ.name = name;
    if (notes !== undefined) organ.notes = notes;
    organ.updated_at = nowIso();
    await organ.save();

    logger.info(`Organico aggiornato: ${organ.id}`, {
      correlationId: req.correlationId,
    });

    res.json(organ);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/organs/:organId (soft delete)
 */
exports.deleteOrgan = async (req, res, next) => {
  try {
    const { organId } = req.params;

    const organ = await Organ.findOne({
      where: { id: organId, deleted_at: null },
    });
    if (!organ) {
      const err = new Error(`Organ ${organId} not found`);
      err.status = 404;
      return next(err);
    }

    organ.deleted_at = nowIso();
    organ.updated_at = nowIso();
    await organ.save();

    logger.info(`Organico eliminato (soft): ${organ.id}`, {
      correlationId: req.correlationId,
    });

    res.json({ message: 'Organ deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================
// SLOT
// ============================================

/**
 * POST /api/organs/:organId/slots
 */
exports.createSlot = async (req, res, next) => {
  try {
    const { organId } = req.params;
    const { section, instrument, quantity, notes, order_index } = req.body;

    if (!section || !ORGAN_SECTIONS.includes(section)) {
      const err = new Error(`Invalid section. Allowed: ${ORGAN_SECTIONS.join(', ')}`);
      err.status = 400;
      return next(err);
    }
    if (!instrument || instrument.trim() === '') {
      const err = new Error('instrument is required');
      err.status = 400;
      return next(err);
    }

    const organ = await Organ.findOne({
      where: { id: organId, deleted_at: null },
      attributes: ['id'],
    });
    if (!organ) {
      const err = new Error(`Organ ${organId} not found`);
      err.status = 404;
      return next(err);
    }

    const slot = await OrganSlot.create({
      id: generateId('slot'),
      organ_id: organId,
      section,
      instrument: instrument.trim(),
      quantity: quantity || 1,
      notes: notes || null,
      order_index: order_index || 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    logger.info(`Slot creato: ${slot.id}`, {
      correlationId: req.correlationId,
      organId,
    });

    res.status(201).json(slot);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/organ-slots/:slotId
 */
exports.updateSlot = async (req, res, next) => {
  try {
    const { slotId } = req.params;
    const { section, instrument, quantity, notes, order_index } = req.body;

    const slot = await OrganSlot.findOne({
      where: { id: slotId, deleted_at: null },
    });
    if (!slot) {
      const err = new Error(`Slot ${slotId} not found`);
      err.status = 404;
      return next(err);
    }

    if (section !== undefined) {
      if (!ORGAN_SECTIONS.includes(section)) {
        const err = new Error(`Invalid section. Allowed: ${ORGAN_SECTIONS.join(', ')}`);
        err.status = 400;
        return next(err);
      }
      slot.section = section;
    }
    if (instrument !== undefined) slot.instrument = instrument.trim();
    if (quantity !== undefined) slot.quantity = quantity;
    if (notes !== undefined) slot.notes = notes;
    if (order_index !== undefined) slot.order_index = order_index;

    slot.updated_at = nowIso();
    await slot.save();

    logger.info(`Slot aggiornato: ${slot.id}`, {
      correlationId: req.correlationId,
    });

    res.json(slot);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/organ-slots/:slotId (soft delete)
 */
exports.deleteSlot = async (req, res, next) => {
  try {
    const { slotId } = req.params;

    const slot = await OrganSlot.findOne({
      where: { id: slotId, deleted_at: null },
    });
    if (!slot) {
      const err = new Error(`Slot ${slotId} not found`);
      err.status = 404;
      return next(err);
    }

    slot.deleted_at = nowIso();
    slot.updated_at = nowIso();
    await slot.save();

    logger.info(`Slot eliminato (soft): ${slot.id}`, {
      correlationId: req.correlationId,
    });

    res.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    next(error);
  }
};