const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Event = sequelize.define('Event', {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    theme: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    date: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    location: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    category: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: 'concerto'
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: 'published'
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 999
    },
    registration_deadline: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    difficulty: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: 'intermediate'
    },
    duration: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    contact_email: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    contact_phone: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    video_url: {
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
    }
  }, {
    tableName: 'events',
    timestamps: false,
    underscored: true
  });

  Event.associate = (models) => {
    Event.belongsToMany(models.Song, {
      through: models.EventSong,
      foreignKey: 'event_id',
      otherKey: 'song_id',
      as: 'songs'
    });
  };

  return Event;
};