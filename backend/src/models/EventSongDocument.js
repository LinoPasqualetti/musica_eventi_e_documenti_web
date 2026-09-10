const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EventSongDocument = sequelize.define('EventSongDocument', {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false
    },
    event_song_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'event_songs', key: 'id' }
    },
    document_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'documents', key: 'id' }
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
    tableName: 'event_song_documents',
    timestamps: false,
    underscored: true
  });

  EventSongDocument.associate = (models) => {
    EventSongDocument.belongsTo(models.EventSong, {
      foreignKey: 'event_song_id',
      as: 'event_song'
    });
    EventSongDocument.belongsTo(models.Document, {
      foreignKey: 'document_id',
      as: 'document'
    });
  };

  return EventSongDocument;
};