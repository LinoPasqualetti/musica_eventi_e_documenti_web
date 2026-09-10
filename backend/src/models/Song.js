const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Song = sequelize.define('Song', {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    composer: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_by: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    updated_at: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    difficulty: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    genre: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    tempo: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    key_signature: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    time_signature: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    lyrics: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'songs',
    timestamps: false,
    underscored: true
  });

  Song.associate = (models) => {
    Song.belongsToMany(models.Event, {
      through: models.EventSong,
      foreignKey: 'song_id',
      otherKey: 'event_id',
      as: 'events'
    });
    Song.belongsToMany(models.Document, {
      through: models.SongDocument,
      foreignKey: 'song_id',
      otherKey: 'document_id',
      as: 'documents'
    });
  };

  return Song;
};