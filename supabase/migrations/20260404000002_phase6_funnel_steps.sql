-- ============================================================
-- NOMAD FOR LIFE — Phase 6: Funnel-stappen uitbreiding
-- Migration: 20260404000002_phase6_funnel_steps
--
-- Voegt per-stap onderwerpregel, preview-tekst, verzendconditie
-- en stap-status toe aan campaign_steps.
-- Voegt indexen toe voor efficiënte plannerqueries op mail_logs.
-- ============================================================

-- 1. Extend campaign_steps
ALTER TABLE campaign_steps
  ADD COLUMN IF NOT EXISTS subject          text,
  ADD COLUMN IF NOT EXISTS preview_text     text,
  ADD COLUMN IF NOT EXISTS send_condition   jsonb,
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused'));

-- 2. Indexen voor plannerqueries op mail_logs
--    De planner zoekt per stap welke runs al een log hebben
--    (deduplicatie) en haalt de vorige-stap-logs op.

CREATE INDEX IF NOT EXISTS idx_mail_logs_step_id
  ON mail_logs (campaign_step_id);

-- Partial index: alleen openstaande logs (polling door planner)
CREATE INDEX IF NOT EXISTS idx_mail_logs_pending
  ON mail_logs (campaign_step_id)
  WHERE status = 'pending';

-- Composite index voor run+stap deduplicatie
CREATE INDEX IF NOT EXISTS idx_mail_logs_run_step
  ON mail_logs (campaign_run_id, campaign_step_id);

-- 3. Index voor campaign_runs per status (planner filtert op 'active')
CREATE INDEX IF NOT EXISTS idx_campaign_runs_campaign_status
  ON campaign_runs (campaign_id, status);

-- 4. Commentaar
COMMENT ON COLUMN campaign_steps.subject IS
  'Onderwerpregel voor deze funnel-stap. '
  'Wordt gebruikt bij verzending van de stap-mail.';

COMMENT ON COLUMN campaign_steps.preview_text IS
  'Preheader-tekst zichtbaar naast de onderwerpregel in de inbox.';

COMMENT ON COLUMN campaign_steps.send_condition IS
  'Optionele verzendconditie als JSON: '
  '{ "type": "always" | "opened_previous" | "not_opened_previous" | "clicked_previous" }. '
  'NULL = altijd verzenden. Genegeerd voor stap 1.';

COMMENT ON COLUMN campaign_steps.status IS
  'active = stap wordt verwerkt door de planner; '
  'paused = stap wordt tijdelijk overgeslagen.';
