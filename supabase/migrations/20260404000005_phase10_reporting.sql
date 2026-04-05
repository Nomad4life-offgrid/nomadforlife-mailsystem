-- ============================================================
-- NOMAD FOR LIFE — Fase 10: Dashboard & Rapportage
-- Migration: 20260404000005_phase10_reporting
--
-- Wat dit doet:
--   1. Samengestelde index op mail_logs voor campagne-rapport queries
--      (aggregatie per stap + status in één index-scan)
--   2. Index op contacts (status, opted_in) voor dashboard-tellingen
--   3. Index op contacts (global_opt_out) was al aanwezig (initieel schema)
-- ============================================================


-- ── 1. mail_logs: samengestelde index voor rapport-queries ─────────────────
-- Versnelt SELECT ... WHERE campaign_step_id IN (...) GROUP BY status
-- (gebruikt door /campaigns/[id]/report pagina).
CREATE INDEX IF NOT EXISTS idx_mail_logs_step_status
  ON mail_logs (campaign_step_id, status);

-- ── 2. mail_logs: index op status + scheduled_at voor dashboard recent ──────
-- Versnelt "laatste N mislukte/verzonden mails" op het dashboard.
CREATE INDEX IF NOT EXISTS idx_mail_logs_status_scheduled
  ON mail_logs (status, scheduled_at DESC);

-- ── 3. contacts: samengestelde index voor actieve-contact-telling ────────────
-- Versnelt COUNT WHERE status = 'active' AND opted_in = true AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_contacts_active_optedin
  ON contacts (status, opted_in)
  WHERE deleted_at IS NULL;
