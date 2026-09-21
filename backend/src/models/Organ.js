const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Organ = sequelize.define('Organ', {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false,
    },
    event_song_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'Organico standard',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'organs',
    timestamps: false,
    underscored: true,
  });

  Organ.associate = (models) => {
    Organ.belongsTo(models.EventSong, {
      foreignKey: 'event_song_id',
      as: 'eventSong',
    });
    Organ.hasMany(models.OrganSlot, {
      foreignKey: 'organ_id',
      as: 'slots',
      onDelete: 'CASCADE',
    });
  };

  return Organ;
};