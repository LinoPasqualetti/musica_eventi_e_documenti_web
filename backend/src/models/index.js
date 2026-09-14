const { sequelize } = require('../config/database');

const Event = require('./Event');
const Song = require('./Song');
const Document = require('./Document');
const EventSong = require('./EventSong');
const SongDocument = require('./SongDocument');
const EventSongDocument = require('./EventSongDocument');
const Registration = require('./Registration');

const models = {
  Event: Event(sequelize),
  Song: Song(sequelize),
  Document: Document(sequelize),
  EventSong: EventSong(sequelize),
  SongDocument: SongDocument(sequelize),
  EventSongDocument: EventSongDocument(sequelize),
  Registration: Registration(sequelize)
};

// Imposta le associazioni
Object.values(models).forEach(model => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  ...models,
  sequelize
};
