const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Document = sequelize.define('Document', {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false
    },
    doc_type: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    file_name: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    file_path: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    uploaded_by: {
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
    storage_mode: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'filesystem'
    },
    content: {
      type: DataTypes.BLOB,
      allowNull: true
    },
    mime_type: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'documents',
    timestamps: false,
    underscored: true
  });

  Document.associate = (models) => {
    Document.belongsToMany(models.Song, {
      through: models.SongDocument,
      foreignKey: 'document_id',
      otherKey: 'song_id',
      as: 'songs'
    });
  };

  return Document;
};