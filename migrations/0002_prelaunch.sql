-- Run ONCE on the existing kurant-waitlist database (D1 console: paste, Execute).
-- Adds the pre-launch list columns. Existing rows keep their data, get a founder number in sign-up
-- order, a token and a referral code, and stay unconfirmed until they click the confirmation email
-- (send it with POST /api/admin/resend, see README).

ALTER TABLE waitlist ADD COLUMN email_norm TEXT;
ALTER TABLE waitlist ADD COLUMN token TEXT;
ALTER TABLE waitlist ADD COLUMN ref_code TEXT;
ALTER TABLE waitlist ADD COLUMN referred_by TEXT;
ALTER TABLE waitlist ADD COLUMN founder_no INTEGER;
ALTER TABLE waitlist ADD COLUMN confirmed_at TEXT;
ALTER TABLE waitlist ADD COLUMN confirm_sent_at TEXT;
ALTER TABLE waitlist ADD COLUMN intent TEXT;
ALTER TABLE waitlist ADD COLUMN synced_at TEXT;

UPDATE waitlist SET
  email_norm = lower(email),
  token      = lower(hex(randomblob(16))),
  ref_code   = substr(lower(hex(randomblob(4))), 1, 6),
  founder_no = (SELECT COUNT(*) FROM waitlist AS w2 WHERE w2.id <= waitlist.id);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_token ON waitlist (token);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_ref_code ON waitlist (ref_code);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_founder_no ON waitlist (founder_no);
CREATE INDEX IF NOT EXISTS waitlist_email_norm ON waitlist (email_norm);
CREATE INDEX IF NOT EXISTS waitlist_referred_by ON waitlist (referred_by);

CREATE TABLE IF NOT EXISTS signup_events (
  ip_hash TEXT NOT NULL,
  at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS signup_events_ip ON signup_events (ip_hash, at);
