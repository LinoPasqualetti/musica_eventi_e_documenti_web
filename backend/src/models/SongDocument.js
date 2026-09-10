const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SongDocument = sequelize.define('SongDocument', {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false
    },
    song_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: {
        model: 'songs',
        key: 'id'
      }
    },
    document_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: {
        model: 'documents',
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
    tableName: 'song_documents',
    timestamps: false,
    underscored: true
  });

  return SongDocument;
};