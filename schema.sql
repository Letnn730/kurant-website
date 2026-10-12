-- Kurant waitlist (Cloudflare D1). Full schema for a NEW database.
-- An existing database (created before the pre-launch list) runs migrations/0002_prelaunch.sql instead.

CREATE TABLE IF NOT EXISTS waitlist (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  email            TEXT NOT NULL UNIQUE,
  bike             TEXT,
  controller_label TEXT,
  family           TEXT,
  voltage          TEXT,
  phone_os         TEXT,
  province         TEXT,
  lang             TEXT NOT NULL DEFAULT 'fr',
  consent_version  TEXT NOT NULL,              -- version of the consent text accepted (CASL proof)
  consent_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at  TEXT,
  created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Pre-launch list (double opt-in, founder numbers, referrals)
  email_norm       TEXT,                       -- lower case, +tag removed (and dots for Gmail): one person, one entry
  token            TEXT,                       -- secret: confirm, unsubscribe and the thank-you page
  ref_code         TEXT,                       -- public: the person's referral link (?r=CODE)
  referred_by      TEXT,                       -- ref_code of the person who invited them
  founder_no       INTEGER,                    -- given on confirmation, in order
  confirmed_at     TEXT,                       -- double opt-in: counts only once set
  confirm_sent_at  TEXT,                       -- last confirmation email, for throttling and resends
  intent           TEXT,                       -- day-one answer: yes | maybe | curious
  synced_at        TEXT                        -- last copy to the email provider's contact list
);

CREATE INDEX IF NOT EXISTS waitlist_family ON waitlist (family);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_token ON waitlist (token);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_ref_code ON waitlist (ref_code);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_founder_no ON waitlist (founder_no);
CREATE INDEX IF NOT EXISTS waitlist_email_norm ON waitlist (email_norm);
CREATE INDEX IF NOT EXISTS waitlist_referred_by ON waitlist (referred_by);

-- Sign-up attempts per hashed IP, kept 24 hours, to stop one machine from flooding the form.
CREATE TABLE IF NOT EXISTS signup_events (
  ip_hash TEXT NOT NULL,
  at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS signup_events_ip ON signup_events (ip_hash, at);
