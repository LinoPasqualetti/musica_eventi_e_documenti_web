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

  return EventSong;
};