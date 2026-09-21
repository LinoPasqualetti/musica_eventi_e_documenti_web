const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Registration = sequelize.define('Registration', {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false
    },
    event_id: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    user_id: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      // Valori ammessi:
      //   'pending'    - in attesa di validazione
      //   'waitlist'   - in lista d'attesa
      //   'confirmed'  - confermato dall'admin
      //   'rejected'   - rifiutato dall'admin
      //   'cancelled'  - cancellato dall'utente
      //   (legacy: 'exported', 'imported', 'validated', 'published')
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'pending'
    },
    instrument_choice: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    reading_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    improvisation_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    selected_song_ids: {
      // LEGACY: lista separata da virgole. Non più usato.
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    confirmed_at: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    cancelled_at: {
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
    },
    // ─── Nuove colonne (organico) ────────────────────────────────
    song_id: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    organ_slot_id: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    time_description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    deleted_at: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    synced_to_flutter_at: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    candidate_name: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    candidate_email: {
      type: DataTypes.TEXT,
      allowNull: true
    },
  }, {
    tableName: 'registrations',
    timestamps: false,
    underscored: true
  });

  Registration.associate = (models) => {
    Registration.belongsTo(models.Event, {
      foreignKey: 'event_id',
      as: 'event'
    });
    Registration.belongsTo(models.Song, {
      foreignKey: 'song_id',
      as: 'song'
    });
    Registration.belongsTo(models.OrganSlot, {
      foreignKey: 'organ_slot_id',
      as: 'organSlot'
    });
    Registration.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return Registration;
};