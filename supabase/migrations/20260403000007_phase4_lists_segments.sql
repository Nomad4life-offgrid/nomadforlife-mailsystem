-- ============================================================
-- NOMAD FOR LIFE — Phase 4: Statische lijsten & dynamische segmenten
-- Migration: 20260403000007_phase4_lists_segments
-- ============================================================

-- 1. Extend contact_groups: list_type, is_locked, created_by
--    list_type = 'group'  → organisatorische doelgroep (campings, sponsors, …)
--    list_type = 'list'   → formele mailinglist (handmatig samengesteld)

ALTER TABLE contact_groups
  ADD COLUMN IF NOT EXISTS list_type  text NOT NULL DEFAULT 'group'
    CHECK (list_type IN ('group', 'list')),
  ADD COLUMN IF NOT EXISTS is_locked  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- 2. Dynamic segments — filter_json driven, preview_count cached

CREATE TABLE IF NOT EXISTS segments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL UNIQUE,
  description   text,
  -- JSON: { operator: 'AND'|'OR', conditions: [{ field, op, value }] }
  filter_json   jsonb       NOT NULL DEFAULT '{"operator":"AND","conditions":[]}',
  preview_count integer,        -- cached, updated by refresh action
  refreshed_at  timestamptz,    -- when preview_count was last computed
  created_by    uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_segments_name ON segments (name);

DROP TRIGGER IF EXISTS trg_segments_updated_at ON segments;
CREATE TRIGGER trg_segments_updated_at
  BEFORE UPDATE ON segments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
