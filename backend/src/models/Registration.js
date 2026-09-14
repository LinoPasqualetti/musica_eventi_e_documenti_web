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
      //   'pending'    - Utente iscritto, in attesa di export
      //   'exported'   - Esportato in JSON, in attesa di import sul desktop
      //   'imported'   - Importato sul desktop, in attesa di validazione
      //   'validated'  - Admin ha approvato
      //   'rejected'   - Admin ha rifiutato
      //   'published'  - Ripubblicato sul web (stato finale)
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
    }
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
  };

  return Registration;
};
