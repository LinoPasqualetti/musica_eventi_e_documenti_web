/**
 * 📁 PERCORSO: C:\musica_eventi_e_documenti_web\backend\src\models\EventSong.js
 *
 * 📝 DESCRIZIONE: Modello EventSong - rappresenta la relazione tra un Event e una Song
 * (un evento può avere più brani, un brano può essere in più eventi)
 *
 * 🔧 FIX APPLICATE (2026-09-24):
 * - Aggiunto blocco `associate` con le relazioni mancanti:
 *   - belongsTo(Song) → per accedere a `eventSong.song`
 *   - belongsTo(Event) → per accedere a `eventSong.event`
 *   - hasMany(Organ) → per accedere a `eventSong.organs`
 *   Questo permette gli include annidati senza errori
 *   "Song is not associated to EventSong"
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EventSong = sequelize.define('EventSong', {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false
    },
    event_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      }
    },
    song_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: {
        model: 'songs',
        key: 'id'
      }
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    updated_at: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'event_songs',
    timestamps: false,
    underscored: true
  });

  // ============================================
  // 🔗 ASSOCIAZIONI
  // ============================================
  EventSong.associate = (models) => {
    // EventSong → Song (un evento-canzone appartiene a UNA canzone)
    EventSong.belongsTo(models.Song, {
      foreignKey: 'song_id',
      as: 'song',
    });

    // EventSong → Event (un evento-canzone appartiene a UN evento)
    EventSong.belongsTo(models.Event, {
      foreignKey: 'event_id',
      as: 'event',
    });

    // EventSong → Organ (un evento-canzone può avere PIÙ organici)
    EventSong.hasMany(models.Organ, {
      foreignKey: 'event_song_id',
      as: 'organs',
    });
  };

  return EventSong;
};