-- Run ONCE on the existing kurant-waitlist database (D1 console: paste, Execute).
-- Adds the anonymous funnel counters used by POST /api/event (see functions/api/event.js).
-- One row per day, page language, event and label; no IP, cookie or identifier is stored.

CREATE TABLE IF NOT EXISTS events (
  day   TEXT NOT NULL,                -- YYYY-MM-DD (UTC)
  page  TEXT NOT NULL,                -- fr | en
  name  TEXT NOT NULL,                -- event name, from the list in functions/api/event.js
  label TEXT NOT NULL DEFAULT '',     -- e.g. the system chosen in the checker
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, page, name, label)
);
