-- ============================================================
-- NOMAD FOR LIFE — Contactgroepen / Segmenten
-- Migration: 20260403000003_segments
-- ============================================================

-- Contactgroepen (segmenten): campings, sponsors, adverteerders, leden etc.
CREATE TABLE contact_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  description text,
  color       text        NOT NULL DEFAULT '#71717a',  -- voor UI labels
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_groups_name ON contact_groups (name);

-- Koppeltabel: één contact kan in meerdere groepen zitten
CREATE TABLE contact_group_members (
  contact_id uuid NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  group_id   uuid NOT NULL REFERENCES contact_groups (id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, group_id)
);

CREATE INDEX idx_contact_group_members_group_id   ON contact_group_members (group_id);
CREATE INDEX idx_contact_group_members_contact_id ON contact_group_members (contact_id);

-- Trigger updated_at op contact_groups
CREATE TRIGGER trg_contact_groups_updated_at
  BEFORE UPDATE ON contact_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed: de zes doelgroepen voor Nomad For Life
INSERT INTO contact_groups (name, description, color) VALUES
  ('Campings & camperplaatsen', 'Campings en camperplaatsen in Nederland en België', '#16a34a'),
  ('Sponsors',                  'Bedrijven die Nomad For Life financieel steunen',   '#2563eb'),
  ('Adverteerders',             'Partijen die adverteren via Nomad For Life',         '#7c3aed'),
  ('Leden',                     'Betalende leden van Nomad For Life',                 '#ea580c'),
  ('Partners',                  'Samenwerkingspartners',                              '#0891b2'),
  ('Prospects',                 'Potentiële klanten en geïnteresseerden',             '#ca8a04');
