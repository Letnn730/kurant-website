-- Run ONCE on the kurant-waitlist database (D1 console: paste, Execute), after 0002_prelaunch.sql.
-- Where each sign-up came from, to judge traffic channels by confirmed sign-ups.
-- Existing rows keep NULL here: they signed up before this was recorded.

ALTER TABLE waitlist ADD COLUMN src TEXT;            -- utm_source, or the referring site's host when there is none
ALTER TABLE waitlist ADD COLUMN medium TEXT;         -- utm_medium
ALTER TABLE waitlist ADD COLUMN campaign TEXT;       -- utm_campaign
ALTER TABLE waitlist ADD COLUMN landing TEXT;        -- the page the visit started on, e.g. /en/
ALTER TABLE waitlist ADD COLUMN form TEXT;           -- which form was used: hero | main

CREATE INDEX IF NOT EXISTS waitlist_src ON waitlist (src, campaign);
