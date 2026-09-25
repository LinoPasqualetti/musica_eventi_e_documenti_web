// backend/src/controllers/syncController.js
/**
 * Sync bidirezionale Web <-> Flutter per le candidature.
 *
 * - pull:  Flutter chiede al Web le candidature modificate dopo un timestamp
 * - ack:   Flutter conferma di aver ricevuto un batch → Web marca synced_to_flutter_at
 * - push:  Flutter invia modifiche (status, time_description, ecc.) → Web aggiorna
 *
 * Regole:
 * - Web è master per dati anagrafici (candidate_name, email, slot, time_description)
 * - Flutter è master per status (confirmed/rejected/waitlist)
 * - last-write-wins su updated_at in caso di conflitto
 *
 * 🔧 FIX APPLICATE (2026-09-25):
 * 1. ack: NON tocca più updated_at (evita pull infinito)
 * 2. push: gestisce correttamente cancelled → deleted_at
 * 3. push: blocca overbooking (confirmed > quantity)
 * 4. push: auto-popa confirmed_at/cancelled_at quando mancano
 * 5. pull: aggiunto limit/offset per paginazione
 */

const { Op } = require('sequelize');
const { Registration, OrganSlot } = require('../models');
const logger = require('../config/logger');

function nowIso() {
  return new Date().toISOString();
}

const DEFAULT_PULL_LIMIT = 200;

// ============================================
// GET /api/registrations/since?timestamp=ISO8601&limit=200&offset=0
// Pull: candidature modificate dopo <timestamp>
// ============================================
exports.pull = async (req, res, next) => {
  try {
    const { timestamp } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_PULL_LIMIT, 1000);
    const offset = parseInt(req.query.offset, 10) || 0;

    // Se non c'è timestamp, ritorna TUTTO (per il primo sync)
    const since = timestamp ? new Date(timestamp) : new Date(0);

    // Ritorna candidature:
    // 1. modificate dopo <since>
    // 2. OPPURE mai sincronizzate con Flutter (synced_to_flutter_at IS NULL)
    const { count, rows: registrations } = await Registration.findAndCountAll({
      where: {
        [Op.or]: [
          { updated_at: { [Op.gt]: since.toISOString() } },
          { synced_to_flutter_at: null },
        ],
      },
      order: [['updated_at', 'ASC']],
      limit,
      offset,
    });

    logger.info(`📤 Pull sync: ${registrations.length}/${count} candidature`, {
      correlationId: req.correlationId,
      since: since.toISOString(),
      count: registrations.length,
      total: count,
      offset,
      limit,
    });

    res.json({
      serverTime: nowIso(),
      since: since.toISOString(),
      count: registrations.length,
      total: count,
      offset,
      limit,
      hasMore: offset + registrations.length < count,
      registrations: registrations.map((r) => ({
        id: r.id,
        event_id: r.event_id,
        user_id: r.user_id,
        song_id: r.song_id,
        organ_slot_id: r.organ_slot_id,
        candidate_name: r.candidate_name,
        candidate_email: r.candidate_email,
        time_description: r.time_description,
        status: r.status,
        notes: r.notes,
        admin_notes: r.admin_notes,
        confirmed_at: r.confirmed_at,
        cancelled_at: r.cancelled_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// POST /api/registrations/ack
// Body: { ids: [...] }
// Flutter conferma di aver ricevuto le candidature
//
// 🔧 FIX: NON aggiorna più updated_at (evita pull infinito)
// ============================================
exports.ack = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids deve essere un array non vuoto' });
    }

    const now = nowIso();
    const [updated] = await Registration.update(
      { synced_to_flutter_at: now },   // ← solo questo, NON updated_at
      { where: { id: ids } }
    );

    logger.info(`📥 Ack sync: ${updated} candidature marcate`, {
      correlationId: req.correlationId,
      count: updated,
    });

    res.json({ acknowledged: updated, synced_at: now });
  } catch (error) {
    next(error);
  }
};

// ============================================
// POST /api/registrations/push
// Body: { registrations: [{ id, status, time_description, admin_notes, updated_at }] }
// Flutter invia modifiche fatte in locale
//
// 🔧 FIX:
// 1. Gestisce cancelled → cancelled_at + deleted_at
// 2. Auto-popa confirmed_at quando manca
// 3. Blocca overbooking (confirmed > quantity)
// ============================================
exports.push = async (req, res, next) => {
  try {
    const { registrations } = req.body;

    if (!Array.isArray(registrations)) {
      return res.status(400).json({ error: 'registrations deve essere un array' });
    }

    const results = [];
    const now = nowIso();

    for (const item of registrations) {
      try {
        const existing = await Registration.findByPk(item.id);
        if (!existing) {
          results.push({ id: item.id, status: 'not_found' });
          continue;
        }

        // Last-write-wins: se il record Web è più recente, ignora il push
        const webUpdated = existing.updated_at ? new Date(existing.updated_at) : new Date(0);
        const flutterUpdated = item.updated_at ? new Date(item.updated_at) : new Date(0);

        if (webUpdated > flutterUpdated) {
          results.push({
            id: item.id,
            status: 'skipped',
            reason: 'web_is_newer',
            web_updated_at: existing.updated_at,
          });
          continue;
        }

        // Determina se stiamo cambiando status (per gestire confirmed/cancelled)
        const newStatus = item.status ?? existing.status;
        const statusChanged = newStatus !== existing.status;

        // 🔒 FIX 3: blocca overbooking se stiamo confermando
        if (statusChanged && newStatus === 'confirmed' && existing.organ_slot_id) {
          const slot = await OrganSlot.findByPk(existing.organ_slot_id);

          if (!slot) {
            // slot orfano: rifiuta la conferma
            results.push({
              id: item.id,
              status: 'error',
              error: 'slot_not_found',
              organ_slot_id: existing.organ_slot_id,
            });
            continue;
          }

          const confirmedCount = await Registration.count({
            where: {
              organ_slot_id: existing.organ_slot_id,
              status: 'confirmed',
              deleted_at: null,
              id: { [Op.ne]: item.id },
            },
          });

          if (confirmedCount >= slot.quantity) {
            logger.warn('⛔ Push rifiutato: slot pieno', {
              correlationId: req.correlationId,
              registrationId: item.id,
              organ_slot_id: existing.organ_slot_id,
              confirmedCount,
              quantity: slot.quantity,
            });
            results.push({
              id: item.id,
              status: 'error',
              error: 'slot_full',
              confirmedCount,
              quantity: slot.quantity,
            });
            continue;
          }
        }

        // Costruisci updates
        const updates = {
          status: newStatus,
          updated_at: item.updated_at || now,
        };

        if (item.time_description !== undefined) {
          updates.time_description = item.time_description;
        }
        if (item.admin_notes !== undefined) {
          updates.admin_notes = item.admin_notes;
        }
        if (item.confirmed_at !== undefined) {
          updates.confirmed_at = item.confirmed_at;
        }
        if (item.cancelled_at !== undefined) {
          updates.cancelled_at = item.cancelled_at;
        }
        if (item.deleted_at !== undefined) {
          updates.deleted_at = item.deleted_at;
        }

        // 🔒 FIX 2: coerenza cancelled → cancelled_at + deleted_at
        if (updates.status === 'cancelled') {
          if (!updates.cancelled_at && !existing.cancelled_at) {
            updates.cancelled_at = now;
          }
          if (!updates.deleted_at && !existing.deleted_at) {
            updates.deleted_at = now;
          }
        }

        // 🔒 FIX 4: auto-popa confirmed_at quando si passa a confirmed
        if (updates.status === 'confirmed' && statusChanged) {
          if (!updates.confirmed_at && !existing.confirmed_at) {
            updates.confirmed_at = now;
          }
        }

        await existing.update(updates);

        results.push({
          id: item.id,
          status: 'updated',
          server_updated_at: updates.updated_at,
        });
      } catch (e) {
        results.push({ id: item.id, status: 'error', error: e.message });
      }
    }

    const updated = results.filter((r) => r.status === 'updated').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const errors = results.filter((r) => r.status === 'error' || r.status === 'not_found').length;

    logger.info(`📤 Push sync: ${updated} aggiornate, ${skipped} saltate, ${errors} errori`, {
      correlationId: req.correlationId,
      updated,
      skipped,
      errors,
    });

    res.json({
      serverTime: now,
      updated,
      skipped,
      errors,
      results,
    });
  } catch (error) {
    next(error);
  }
};