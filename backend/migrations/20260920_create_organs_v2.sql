-- ============================================================
-- Migrazione v2: organs legato a event_song_id
-- Data: 2026-09-20
-- Descrizione: l'organico è specifico per il brano in un evento
-- ============================================================

CREATE TABLE IF NOT EXISTS organs (
  id             TEXT PRIMARY KEY,
  event_song_id  TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT 'Organico standard',
  notes          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT,
  deleted_at     TEXT,
  FOREIGN KEY (event_song_id) REFERENCES event_songs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_organs_event_song_id ON organs(event_song_id);
CREATE INDEX IF NOT EXISTS idx_organs_deleted_at    ON organs(deleted_at);

CREATE TABLE IF NOT EXISTS organ_slots (
  id           TEXT PRIMARY KEY,
  organ_id     TEXT NOT NULL,
  section      TEXT NOT NULL CHECK (section IN ('ritmica','armonica','solistica','orchestrale')),
  instrument   TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  notes        TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT,
  deleted_at   TEXT,
  FOREIGN KEY (organ_id) REFERENCES organs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_organ_slots_organ_id   ON organ_slots(organ_id);
CREATE INDEX IF NOT EXISTS idx_organ_slots_section    ON organ_slots(section);
CREATE INDEX IF NOT EXISTS idx_organ_slots_deleted_at ON organ_slots(deleted_at);