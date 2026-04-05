-- ============================================================
-- NOMAD FOR LIFE — Fase 11: Publiek inschrijvendpoint
-- Migration: 20260404000006_phase11_subscribe_endpoint
--
-- Ondersteunt POST /api/public/subscribe:
--   - Snelle duplicate-check via email (al aanwezig: idx_contacts_email)
--   - Snel opzoeken van open tokens per contact
--   - Index op source voor rapportage-queries
-- ============================================================

-- ── 1. Contacts: index op source voor analytics ──────────────────────────────
-- Versnelt COUNT(*) WHERE source = 'website' AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_contacts_source
  ON contacts (source)
  WHERE deleted_at IS NULL;

-- ── 2. opt_in_tokens: samengestelde index ongebruikte tokens per contact ──────
-- Versnelt lookup "heeft dit contact al een openstaand token?"
-- Vult de bestaande idx_opt_in_tokens_contact_id aan met used_at-filter.
CREATE INDEX IF NOT EXISTS idx_opt_in_tokens_contact_pending
  ON opt_in_tokens (contact_id, created_at DESC)
  WHERE used_at IS NULL;

-- ── 3. contact_group_members: ensure index on group_id + contact_id ──────────
-- Versnelt de upsert-check bij lijst-koppeling na aanmelding.
CREATE INDEX IF NOT EXISTS idx_contact_group_members_lookup
  ON contact_group_members (group_id, contact_id);
